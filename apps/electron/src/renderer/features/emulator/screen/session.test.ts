import type { SocketCloseEvent, SocketMessageEvent } from "@tesseract/client";
import { describe, expect, it } from "vitest";
import { ANDROID_SCREEN, IOS_SCREEN } from "../constants";
import { ScreenSession, type ScreenSocket } from "./session";

class FakeSocket implements ScreenSocket {
  readyState = 1;
  binaryType?: string;
  sent: unknown[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: SocketMessageEvent) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: SocketCloseEvent) => void) | null = null;
  closed = false;

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: "" });
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function setup(h264 = false, spec = ANDROID_SCREEN) {
  const sockets: FakeSocket[] = [];
  const queries: string[] = [];
  const session = new ScreenSession(spec, {
    canDecodeH264: async () => h264,
    openSocket: async (path, query) => {
      queries.push(`${path}?${query.toString()}`);
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
  });
  return { session, sockets, queries };
}

describe("ScreenSession", () => {
  it("connects with the serial and becomes live on meta", async () => {
    const { session, sockets, queries } = setup();
    await session.connect({ device: "emulator-5554" });
    expect(queries).toEqual(["/v1/android/screen?serial=emulator-5554"]);
    expect(session.state.status).toBe("connecting");
    sockets[0]!.receive({ type: "meta", deviceName: "Pixel", codec: "mjpeg", width: 1080, height: 2400 });
    expect(session.state).toMatchObject({ status: "connected", title: "Pixel", size: { width: 1080, height: 2400 } });
  });

  it("asks for H.264 when the decoder is available", async () => {
    const { session, queries } = setup(true);
    await session.connect({ device: null });
    expect(queries[0]).toBe("/v1/android/screen?codec=h264");
  });

  it("sends keys and text only while open", async () => {
    const { session, sockets } = setup();
    await session.connect({ device: null });
    session.key({ key: "Enter", ctrlKey: false, altKey: false, metaKey: false });
    session.text("ok");
    session.send({ type: "rotate" });
    expect(sockets[0]!.sent).toEqual([{ type: "key", key: "enter" }, { type: "text", text: "ok" }, { type: "rotate" }]);
  });

  it("reports a server error when the stream closes", async () => {
    const { session, sockets } = setup();
    await session.connect({ device: null });
    sockets[0]!.receive({ type: "error", message: "device offline" });
    sockets[0]!.close();
    expect(session.state).toMatchObject({ status: "error", error: "device offline" });
  });

  it("closes the previous socket on reconnect and resets on disconnect", async () => {
    const { session, sockets } = setup();
    await session.connect({ device: null });
    await session.connect({ device: null });
    expect(sockets[0]!.closed).toBe(true);
    expect(session.state.status).toBe("connecting");
    session.disconnect();
    expect(sockets[1]!.closed).toBe(true);
    expect(session.state.status).toBe("idle");
  });

  it("streams the iOS screen by udid and never asks for H.264", async () => {
    const { session, queries } = setup(true, IOS_SCREEN);
    await session.connect({ device: "5A7C3E21-9B0D-4F6A-8E1C-2D3B4A5F6E7D" });
    expect(queries).toEqual(["/v1/ios/screen?udid=5A7C3E21-9B0D-4F6A-8E1C-2D3B4A5F6E7D"]);
  });
});
