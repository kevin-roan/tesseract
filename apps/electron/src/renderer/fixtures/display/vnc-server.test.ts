import { describe, expect, it } from "vitest";
import { FixtureVncChannel } from "./vnc-server";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function client(channel: FixtureVncChannel) {
  const messages: number[][] = [];
  channel.onmessage = (event) => messages.push(Array.from(new Uint8Array(event.data as ArrayBuffer)));
  const send = (bytes: number[]) => channel.send(Uint8Array.from(bytes));
  return { messages, send };
}

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

describe("FixtureVncChannel", () => {
  it("speaks RFB 3.8 with Security None and sends one raw frame", async () => {
    const pixels = Uint8ClampedArray.from([1, 2, 3, 255, 4, 5, 6, 255]);
    const channel = new FixtureVncChannel({ width: 2, height: 1, name: "T", pixels: () => pixels });
    const { messages, send } = client(channel);
    await tick();
    await tick();
    expect(channel.readyState).toBe(1);
    expect(messages[0]).toEqual(ascii("RFB 003.008\n"));
    send(ascii("RFB 003.008\n"));
    await tick();
    expect(messages[1]).toEqual([1, 1]);
    send([1]);
    await tick();
    expect(messages[2]).toEqual([0, 0, 0, 0]);
    send([1]);
    await tick();
    expect(messages[3]?.slice(0, 4)).toEqual([0, 2, 0, 1]);
    expect(messages[3]?.slice(-5)).toEqual([0, 0, 0, 1, 84]);
    send([0, ...new Array(19).fill(0), 2, 0, 0, 1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 2, 0, 1]);
    await tick();
    const frame = messages[4] ?? [];
    expect(frame.slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(frame.slice(16)).toEqual([1, 2, 3, 255, 4, 5, 6, 255]);
    send([3, 1, 0, 0, 0, 0, 0, 2, 0, 1]);
    await tick();
    expect(messages).toHaveLength(5);
  });

  it("rejects the VNC password when asked to", async () => {
    const channel = new FixtureVncChannel({ auth: "reject", width: 1, height: 1, pixels: () => new Uint8ClampedArray(4) });
    const { messages, send } = client(channel);
    await tick();
    await tick();
    send(ascii("RFB 003.008\n"));
    await tick();
    expect(messages[1]).toEqual([1, 2]);
    send([2]);
    await tick();
    expect(messages[2]).toHaveLength(16);
    send(new Array(16).fill(0));
    await tick();
    expect(messages[3]?.slice(0, 4)).toEqual([0, 0, 0, 1]);
  });

  it("can hang or drop the connection", async () => {
    const hang = new FixtureVncChannel({ transport: "hang" });
    const drop = new FixtureVncChannel({ transport: "drop" });
    const closes: number[] = [];
    drop.onclose = (event) => closes.push(event.code);
    await tick();
    await tick();
    expect(hang.readyState).toBe(0);
    expect(drop.readyState).toBe(3);
    expect(closes).toEqual([1006]);
  });
});
