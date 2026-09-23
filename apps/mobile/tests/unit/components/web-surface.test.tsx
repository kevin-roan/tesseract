import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import WebSurface, { type WebSurfaceHandle } from "@/components/web-surface";
import WebSurfaceWeb from "@/components/web-surface/index.web";
import { messageText } from "@/components/web-surface/message";

import { injectJavaScript, reload } from "../../mocks/react-native-webview";

const ORIGIN = "http://127.0.0.1:7700";
const URI = `${ORIGIN}/ui/vnc#ticket=t`;

beforeEach(() => {
  injectJavaScript.mockClear();
  reload.mockClear();
});

describe("<WebSurface /> (native)", () => {
  it("pins navigation to the sandbox origin", async () => {
    await render(<WebSurface uri={URI} allowedOrigin={ORIGIN} title="Display" />);
    const web = screen.getByTestId("webview");
    const allow = (url: string) => web.props.onShouldStartLoadWithRequest({ url });

    expect(web.props.accessibilityLabel).toBe("Display");
    expect(allow(`${ORIGIN}/ui/vnc`)).toBe(true);
    expect(allow("about:blank")).toBe(true);
    expect(allow("https://evil.example/")).toBe(false);
    expect(web.props.allowFileAccess).toBe(false);
    expect(web.props.setSupportMultipleWindows).toBe(false);
    expect(web.props.mixedContentMode).toBe("never");
  });

  it("forwards page events", async () => {
    const onMessage = jest.fn();
    const onLoad = jest.fn();
    const onError = jest.fn();
    const onTerminate = jest.fn();
    await render(
      <WebSurface
        uri={URI}
        allowedOrigin={ORIGIN}
        title="Display"
        onMessage={onMessage}
        onLoad={onLoad}
        onError={onError}
        onTerminate={onTerminate}
      />,
    );
    const web = screen.getByTestId("webview");

    web.props.onMessage({ nativeEvent: { data: '{"type":"vnc-state"}' } });
    web.props.onLoad();
    web.props.onError({ nativeEvent: { description: "net::ERR_FAILED" } });
    web.props.onHttpError({ nativeEvent: { statusCode: 502 } });
    web.props.onContentProcessDidTerminate();
    web.props.onRenderProcessGone();

    expect(onMessage).toHaveBeenCalledWith('{"type":"vnc-state"}');
    expect(onLoad).toHaveBeenCalled();
    expect(onError.mock.calls).toEqual([["net::ERR_FAILED"], ["HTTP 502"]]);
    expect(onTerminate).toHaveBeenCalledTimes(2);
    expect(web.props.renderLoading()).toBeTruthy();
  });

  it("tolerates missing handlers", async () => {
    await render(<WebSurface uri={URI} allowedOrigin={ORIGIN} title="Display" />);
    const web = screen.getByTestId("webview");
    expect(() => {
      web.props.onMessage({ nativeEvent: { data: "x" } });
      web.props.onLoad();
      web.props.onError({ nativeEvent: { description: "x" } });
      web.props.onContentProcessDidTerminate();
    }).not.toThrow();
  });

  it("exposes script injection, messaging and reload through its handle", async () => {
    const ref = createRef<WebSurfaceHandle>();
    await render(<WebSurface ref={ref} uri={URI} allowedOrigin={ORIGIN} title="Display" />);

    expect(ref.current?.run("1+1;")).toBe(true);
    expect(injectJavaScript).toHaveBeenLastCalledWith("1+1;");
    expect(ref.current?.post({ type: "reconnect", ticket: "t2" })).toBe(true);
    expect(injectJavaScript).toHaveBeenLastCalledWith('window.postMessage({"type":"reconnect","ticket":"t2"}, "*");true;');
    ref.current?.reload();
    expect(reload).toHaveBeenCalled();
  });
});

describe("<WebSurface /> (web)", () => {
  const globals = globalThis as unknown as { window: Record<string, unknown> };
  let listeners: ((event: { source: unknown; origin: string; data: unknown }) => void)[];
  let removed: unknown[];
  const saved = { add: globals.window.addEventListener, remove: globals.window.removeEventListener };

  beforeEach(() => {
    listeners = [];
    removed = [];
    globals.window.addEventListener = jest.fn((_type: string, listener: (typeof listeners)[number]) => listeners.push(listener));
    globals.window.removeEventListener = jest.fn((_type: string, listener: unknown) => removed.push(listener));
  });
  afterEach(() => {
    globals.window.addEventListener = saved.add;
    globals.window.removeEventListener = saved.remove;
  });

  it("renders a sandboxed iframe without top navigation", async () => {
    const onLoad = jest.fn();
    const { container } = await render(<WebSurfaceWeb uri={URI} allowedOrigin={ORIGIN} title="Display" onLoad={onLoad} />);
    const [frame] = container.queryAll((node) => node.type === "iframe");

    expect(frame.props.src).toBe(URI);
    expect(frame.props.title).toBe("Display");
    expect(frame.props.sandbox).not.toContain("allow-top-navigation");
    expect(frame.props.sandbox).not.toContain("allow-popups");
    expect(frame.props.referrerPolicy).toBe("no-referrer");
    await fireEvent(frame, "load");
    expect(onLoad).toHaveBeenCalled();
  });

  it("only forwards messages from the sandbox origin", async () => {
    const onMessage = jest.fn();
    const { unmount } = await render(<WebSurfaceWeb uri={URI} allowedOrigin={ORIGIN.toUpperCase()} title="Display" onMessage={onMessage} />);
    const [listener] = listeners;

    listener({ source: undefined, origin: "https://evil.example", data: "x" });
    listener({ source: undefined, origin: ORIGIN, data: { type: "vnc-state", state: "connected" } });
    listener({ source: undefined, origin: ORIGIN, data: "plain" });
    listener({ source: undefined, origin: ORIGIN, data: 42 });
    listener({ source: {}, origin: ORIGIN, data: "other frame" });
    expect(onMessage.mock.calls).toEqual([['{"type":"vnc-state","state":"connected"}'], ["plain"]]);

    await unmount();
    expect(removed).toEqual([listener]);
  });

  it("does not listen without a message handler and cannot inject scripts", async () => {
    const ref = createRef<WebSurfaceHandle>();
    await render(<WebSurfaceWeb ref={ref} uri={URI} allowedOrigin={ORIGIN} title="Display" />);
    expect(listeners).toHaveLength(0);
    expect(ref.current?.run("1;")).toBe(false);
    expect(ref.current?.post({ type: "x" })).toBe(false);
    expect(() => ref.current?.reload()).not.toThrow();
  });
});

describe("messageText", () => {
  it("passes strings, serialises objects and rejects the rest", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(messageText("hi")).toBe("hi");
    expect(messageText({ a: 1 })).toBe('{"a":1}');
    expect(messageText(null)).toBeNull();
    expect(messageText(7)).toBeNull();
    expect(messageText(circular)).toBeNull();
  });
});
