import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { TRACKPAD_OPTIONS } from "../../src/ui/lib/config";
import { Trackpad } from "../../src/ui/lib/trackpad";

const GLOBALS = ["window", "document", "ResizeObserver", "MouseEvent", "WheelEvent"] as const;
type Globals = Record<(typeof GLOBALS)[number], unknown>;

let dom: Window;
let saved: Globals;

type Received = { type: string; x: number; y: number; button: number; buttons: number; deltaY?: number };

function setup() {
  const document = dom.document;
  const stage = document.createElement("main");
  const canvas = document.createElement("canvas");
  stage.append(canvas);
  document.body.append(stage);
  const rect = (left: number, top: number, width: number, height: number) => () =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;
  (canvas as unknown as HTMLElement).getBoundingClientRect = rect(0, 100, 400, 200);
  const received: Received[] = [];
  for (const type of ["mousedown", "mousemove", "mouseup", "wheel"]) {
    canvas.addEventListener(type, (event) => {
      const mouse = event as unknown as WheelEvent;
      received.push({ type, x: mouse.clientX, y: mouse.clientY, button: mouse.button, buttons: mouse.buttons, ...(type === "wheel" ? { deltaY: mouse.deltaY } : {}) });
    });
  }
  const trackpad = new Trackpad(stage as never, TRACKPAD_OPTIONS);
  const layer = stage.querySelector(".trackpad") as unknown as HTMLElement;
  layer.getBoundingClientRect = rect(0, 0, 400, 700);
  trackpad.attach(canvas as never);
  const touch = (type: string, pointerId: number, clientX: number, clientY: number) =>
    layer.dispatchEvent(new dom.PointerEvent(type, { pointerId, pointerType: "touch", clientX, clientY, cancelable: true }) as never);
  return { trackpad, layer, received, touch, cursor: layer.querySelector(".trackpad__cursor") as unknown as HTMLElement };
}

beforeEach(() => {
  const source = globalThis as unknown as Globals;
  saved = Object.fromEntries(GLOBALS.map((key) => [key, source[key]])) as Globals;
  dom = new Window({ url: "https://box.example.ts.net/ui/vnc" });
  const target = globalThis as unknown as Globals;
  target.window = dom;
  target.document = dom.document;
  target.ResizeObserver = dom.ResizeObserver;
  target.MouseEvent = dom.MouseEvent;
  target.WheelEvent = dom.WheelEvent;
});

afterEach(async () => {
  await dom.happyDOM.close();
  const target = globalThis as unknown as Globals;
  for (const key of GLOBALS) {
    if (saved[key] === undefined) delete target[key];
    else target[key] = saved[key];
  }
});

describe("Trackpad", () => {
  test("stays out of the way until enabled and hides its cursor when disabled", () => {
    const { trackpad, layer, cursor, received, touch } = setup();
    expect(layer.hidden).toBe(true);
    touch("pointerdown", 1, 10, 10);
    touch("pointerup", 1, 10, 10);
    expect(received).toEqual([]);
    trackpad.setEnabled(true);
    expect(layer.hidden).toBe(false);
    expect(cursor.hidden).toBe(false);
    expect(cursor.style.transform).toBe("translate(200px, 200px)");
    trackpad.setEnabled(false);
    expect(cursor.hidden).toBe(true);
    trackpad.setEnabled(true);
    trackpad.attach(null);
    expect(cursor.hidden).toBe(true);
  });

  test("a tap clicks at the virtual pointer, not under the finger", () => {
    const { trackpad, received, touch } = setup();
    trackpad.setEnabled(true);
    touch("pointerdown", 1, 20, 650);
    touch("pointerup", 1, 20, 650);
    expect(received).toEqual([
      { type: "mousedown", x: 200, y: 200, button: 0, buttons: 1 },
      { type: "mouseup", x: 200, y: 200, button: 0, buttons: 0 },
    ]);
  });

  test("dragging moves the pointer relatively and clamps it to the remote screen", () => {
    const { trackpad, received, touch, cursor } = setup();
    trackpad.setEnabled(true);
    touch("pointerdown", 1, 100, 400);
    touch("pointermove", 1, 5000, 400);
    const move = received.at(-1);
    expect(move?.type).toBe("mousemove");
    expect(move?.x).toBe(400);
    expect(move?.y).toBe(200);
    expect(cursor.style.transform).toBe("translate(400px, 200px)");
  });

  test("two-finger drag sends wheel events at the pointer", () => {
    const { trackpad, received, touch } = setup();
    trackpad.setEnabled(true);
    touch("pointerdown", 1, 100, 400);
    touch("pointerdown", 2, 200, 400);
    touch("pointermove", 1, 100, 300);
    touch("pointermove", 2, 200, 300);
    expect(received.map((event) => [event.type, event.deltaY])).toEqual([
      ["wheel", 100],
      ["wheel", 100],
    ]);
  });
});
