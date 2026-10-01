import { MOUSE_BUTTONS } from "./config";
import {
  movePointer,
  pointerDelta,
  pointerFromClient,
  pointerScale,
  pointerToClient,
  TrackpadGestures,
  wheelDelta,
  type MouseButton,
  type Point,
  type Rect,
  type TrackpadAction,
  type TrackpadOptions,
} from "./gestures";

/**
 * A touch layer over the noVNC stage that acts as a laptop touchpad. It keeps a virtual
 * pointer on the remote screen, draws it, and drives noVNC with synthetic mouse and wheel
 * events on its canvas (noVNC reads only clientX/clientY/buttons/deltas from them).
 */
export class Trackpad {
  private readonly layer: HTMLElement;
  private readonly cursor: HTMLElement;
  private readonly gestures: TrackpadGestures;
  private readonly resize = new ResizeObserver(() => this.render());
  private canvas: HTMLCanvasElement | null = null;
  private position: Point = { x: 0.5, y: 0.5 };
  private buttons = 0;
  private enabled = false;

  constructor(
    private readonly stage: HTMLElement,
    private readonly options: TrackpadOptions,
  ) {
    this.layer = document.createElement("div");
    this.layer.className = "trackpad";
    this.layer.hidden = true;
    this.cursor = document.createElement("div");
    this.cursor.className = "trackpad__cursor";
    this.cursor.hidden = true;
    this.layer.append(this.cursor);
    stage.append(this.layer);
    this.gestures = new TrackpadGestures(options, (action) => this.perform(action));
    this.resize.observe(stage);

    this.layer.addEventListener("pointerdown", (event) => this.onPointer(event));
    this.layer.addEventListener("pointermove", (event) => this.onPointer(event));
    this.layer.addEventListener("pointerup", (event) => this.onPointer(event));
    this.layer.addEventListener("pointercancel", (event) => this.onPointer(event));
    this.layer.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
    this.layer.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  attach(canvas: HTMLCanvasElement | null): void {
    if (this.canvas) this.resize.unobserve(this.canvas);
    this.gestures.cancel();
    this.canvas = canvas;
    this.position = { x: 0.5, y: 0.5 };
    this.buttons = 0;
    if (canvas) this.resize.observe(canvas);
    this.render();
  }

  setEnabled(enabled: boolean): void {
    if (!enabled) this.gestures.cancel();
    this.enabled = enabled;
    this.layer.hidden = !enabled;
    this.render();
  }

  private screen(): Rect | null {
    const rect = this.canvas?.isConnected ? this.canvas.getBoundingClientRect() : null;
    return rect && rect.width > 0 && rect.height > 0 ? rect : null;
  }

  private render(): void {
    const screen = this.screen();
    this.cursor.hidden = !this.enabled || !screen;
    if (!screen) return;
    const point = pointerToClient(this.position, screen);
    const origin = this.layer.getBoundingClientRect();
    this.cursor.style.transform = `translate(${point.x - origin.left}px, ${point.y - origin.top}px)`;
  }

  private onPointer(event: PointerEvent): void {
    if (!this.enabled) return;
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    if (event.pointerType === "mouse") {
      this.onMouse(event, point);
      return;
    }
    if (event.type === "pointerdown") this.gestures.down(event.pointerId, point, event.timeStamp);
    else if (event.type === "pointermove") this.gestures.move(event.pointerId, point, event.timeStamp);
    else if (event.type === "pointerup") this.gestures.up(event.pointerId, event.timeStamp);
    else this.gestures.cancel();
  }

  private onMouse(event: PointerEvent, point: Point): void {
    const screen = this.screen();
    if (!screen) return;
    if (event.type === "pointerdown") this.layer.setPointerCapture(event.pointerId);
    this.position = pointerFromClient(point, screen);
    this.buttons = event.buttons;
    const type = event.type === "pointerdown" ? "mousedown" : event.type === "pointermove" ? "mousemove" : "mouseup";
    this.dispatchMouse(type, Math.max(event.button, 0));
    this.render();
  }

  private onWheel(event: WheelEvent): void {
    if (!this.enabled) return;
    event.preventDefault();
    this.dispatchWheel({ x: event.deltaX, y: event.deltaY }, event.deltaMode);
  }

  private perform(action: TrackpadAction): void {
    const screen = this.screen();
    if (!screen) return;
    if (action.kind === "move") {
      const scale = pointerScale(screen, this.layer.getBoundingClientRect(), this.options.screenFraction);
      const delta = pointerDelta(action.dx, action.dy, action.dt, scale, this.options);
      this.position = movePointer(this.position, delta, screen);
      this.dispatchMouse("mousemove", 0);
      this.render();
    } else if (action.kind === "button") {
      this.press(action.button, action.down);
    } else if (action.kind === "click") {
      this.press(action.button, true);
      this.press(action.button, false);
    } else {
      this.dispatchWheel(wheelDelta(action.dx, action.dy, this.options.scrollScale), WheelEvent.DOM_DELTA_PIXEL);
    }
  }

  private press(button: MouseButton, down: boolean): void {
    const { button: index, mask } = MOUSE_BUTTONS[button];
    this.buttons = down ? this.buttons | mask : this.buttons & ~mask;
    this.dispatchMouse(down ? "mousedown" : "mouseup", index);
  }

  private dispatchMouse(type: "mousedown" | "mousemove" | "mouseup", button: number): void {
    const screen = this.screen();
    if (!this.canvas || !screen) return;
    const point = pointerToClient(this.position, screen);
    const init: MouseEventInit = {
      clientX: point.x,
      clientY: point.y,
      button,
      buttons: this.buttons,
      bubbles: true,
      cancelable: true,
      view: window,
    };
    this.canvas.dispatchEvent(new MouseEvent(type, init));
    // noVNC emulates setCapture() on mousedown with a full-page proxy that only a window-level mouseup removes.
    if (type === "mouseup") window.dispatchEvent(new MouseEvent(type, init));
  }

  private dispatchWheel(delta: Point, deltaMode: number): void {
    const screen = this.screen();
    if (!this.canvas || !screen) return;
    const point = pointerToClient(this.position, screen);
    this.canvas.dispatchEvent(
      new WheelEvent("wheel", {
        clientX: point.x,
        clientY: point.y,
        deltaX: delta.x,
        deltaY: delta.y,
        deltaMode,
        buttons: this.buttons,
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  }
}
