import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useToggle } from "@/features/sandbox/hooks/use-toggle";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
}));

beforeEach(() => {
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockRouter.canGoBack.mockReturnValue(true);
});

describe("useToggle", () => {
  it("flips its value with a stable callback", async () => {
    const { result } = await renderHook(() => useToggle(false));
    const [, toggle] = result.current;

    await act(async () => toggle());
    expect(result.current[0]).toBe(true);
    await act(async () => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(result.current[1]).toBe(toggle);
  });
});

describe("useSandboxNavigation", () => {
  it("is stable across renders", async () => {
    const { result, rerender } = await renderHook(() => useSandboxNavigation());
    const first = result.current;
    await rerender({});
    expect(result.current).toBe(first);
  });

  it("pushes and replaces every sandbox route", async () => {
    const { result } = await renderHook(() => useSandboxNavigation());
    const nav = result.current;

    nav.pair();
    nav.repair({ url: "http://127.0.0.1:7700", name: "Box" });
    nav.display();
    nav.project("p1");
    nav.project("p1", "prc_1");
    nav.newProject();
    nav.build("bld_1");
    nav.agentRun("run_1");
    nav.newAgentRun();
    nav.newAgentRun("p1");
    nav.terminal("trm_1");
    nav.newTerminal({ kind: "shell" });
    nav.newTerminal({ kind: "claude", projectId: "p1" });

    expect(mockRouter.push.mock.calls.map(([target]) => target)).toEqual([
      "/pair",
      { pathname: "/pair", params: { url: "http://127.0.0.1:7700", name: "Box" } },
      "/sandbox/display",
      { pathname: "/sandbox/projects/[id]", params: { id: "p1" } },
      { pathname: "/sandbox/projects/[id]", params: { id: "p1", process: "prc_1" } },
      "/sandbox/projects/new",
      { pathname: "/sandbox/builds/[id]", params: { id: "bld_1" } },
      { pathname: "/sandbox/agent/[id]", params: { id: "run_1" } },
      { pathname: "/sandbox/agent/[id]", params: { id: "new" } },
      { pathname: "/sandbox/agent/[id]", params: { id: "new", projectId: "p1" } },
      { pathname: "/sandbox/terminal/[id]", params: { id: "trm_1" } },
      { pathname: "/sandbox/terminal/[id]", params: { id: "new", kind: "shell" } },
      { pathname: "/sandbox/terminal/[id]", params: { id: "new", kind: "claude", projectId: "p1" } },
    ]);

    nav.replaceWithProject("p2");
    nav.replaceWithTerminal("trm_2");
    nav.replaceWithAgentRun("run_2");
    expect(mockRouter.replace.mock.calls.map(([target]) => target)).toEqual([
      { pathname: "/sandbox/projects/[id]", params: { id: "p2" } },
      { pathname: "/sandbox/terminal/[id]", params: { id: "trm_2" } },
      { pathname: "/sandbox/agent/[id]", params: { id: "run_2" } },
    ]);
  });

  it("goes back or falls back to the sandbox tab", async () => {
    const { result } = await renderHook(() => useSandboxNavigation());

    result.current.back();
    result.current.hub();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/agents");

    mockRouter.canGoBack.mockReturnValue(false);
    result.current.back();
    result.current.hub();
    expect(mockRouter.replace).toHaveBeenCalledTimes(2);
    expect(mockRouter.replace).toHaveBeenCalledWith("/agents");
  });
});

describe("useStickToBottom", () => {
  const scrollEvent = (offset: number, content = 1000, layout = 400) =>
    ({
      nativeEvent: {
        contentOffset: { x: 0, y: offset },
        contentSize: { width: 300, height: content },
        layoutMeasurement: { width: 300, height: layout },
      },
    }) as NativeSyntheticEvent<NativeScrollEvent>;

  // The user drags the list to an offset and lets go.
  const dragTo = async (result: { current: ReturnType<typeof useStickToBottom> }, offset: number) => {
    const { scrollProps } = result.current;
    await act(async () => {
      scrollProps.onScrollBeginDrag();
      scrollProps.onScroll(scrollEvent(offset));
      scrollProps.onScrollEndDrag(scrollEvent(offset));
    });
  };

  it("follows new content until the user scrolls away, then jumps back on request", async () => {
    const scrollable = { scrollToEnd: jest.fn() };
    const { result } = await renderHook(() => useStickToBottom(() => scrollable));

    expect(result.current.following).toBe(true);
    result.current.scrollProps.onContentSizeChange();
    expect(scrollable.scrollToEnd).toHaveBeenLastCalledWith({ animated: false });

    await dragTo(result, 100);
    expect(result.current.following).toBe(false);
    scrollable.scrollToEnd.mockClear();
    result.current.scrollProps.onContentSizeChange();
    expect(scrollable.scrollToEnd).not.toHaveBeenCalled();

    await dragTo(result, 560);
    expect(result.current.following).toBe(true);

    await dragTo(result, 0);
    await act(async () => result.current.jumpToEnd());
    expect(result.current.following).toBe(true);
    expect(scrollable.scrollToEnd).toHaveBeenLastCalledWith({ animated: true });
  });

  it("never snaps to the end while a drag or fling is moving the list", async () => {
    const scrollable = { scrollToEnd: jest.fn() };
    const { result } = await renderHook(() => useStickToBottom(() => scrollable));
    const { scrollProps } = result.current;

    // Still within the threshold of the end, but the finger is down: growing content must not pull the list back.
    await act(async () => {
      scrollProps.onScrollBeginDrag();
      scrollProps.onScroll(scrollEvent(580));
    });
    scrollProps.onContentSizeChange();
    expect(scrollable.scrollToEnd).not.toHaveBeenCalled();

    await act(async () => {
      scrollProps.onScrollEndDrag(scrollEvent(400));
      scrollProps.onMomentumScrollBegin();
    });
    scrollProps.onContentSizeChange();
    expect(scrollable.scrollToEnd).not.toHaveBeenCalled();

    await act(async () => result.current.scrollProps.onMomentumScrollEnd(scrollEvent(600)));
    expect(result.current.following).toBe(true);
    result.current.scrollProps.onContentSizeChange();
    expect(scrollable.scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it("ignores scrolls the user didn't make", async () => {
    const { result } = await renderHook(() => useStickToBottom(() => null));

    await act(async () => result.current.scrollProps.onScroll(scrollEvent(0)));
    expect(result.current.following).toBe(true);
  });

  it("honours a custom threshold and a missing scroll view", async () => {
    const { result } = await renderHook(() => useStickToBottom(() => null, 0));

    await dragTo(result, 599);
    expect(result.current.following).toBe(false);
    await dragTo(result, 600);
    expect(result.current.following).toBe(true);
    expect(() => result.current.scrollProps.onContentSizeChange()).not.toThrow();
    expect(() => result.current.jumpToEnd()).not.toThrow();
  });
});
