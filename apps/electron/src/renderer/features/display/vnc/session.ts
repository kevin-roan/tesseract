import type { DisplayStatus } from "@theone/protocol";
import { ERROR_MESSAGES } from "../../../app/connection/labels";
import { VNC_COMPRESSION_LEVEL, VNC_QUALITY_LEVEL, VNC_WS_PROTOCOLS } from "../constants";
import { SESSION_ERRORS } from "../labels";
import { backoffDelay, INITIAL_SESSION, isDisplayReady } from "../model";
import type { SessionState } from "../types";
import type { RfbChannel, RfbFactory, RfbLike } from "./rfb-types";

export interface SessionDeps {
  fetchStatus(signal: AbortSignal): Promise<DisplayStatus>;
  createTicket(signal: AbortSignal): Promise<string>;
  openChannel(ticket: string): string | RfbChannel;
  createRfb: RfbFactory;
  isAuthError(error: unknown): boolean;
  describeError(error: unknown): string;
  now?: () => number;
  random?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface SessionCallbacks {
  onClipboard?(text: string): void;
}

type Listener = (state: SessionState) => void;

const GHOST_ATTRIBUTE = "data-vnc-ghost";

export class VncSession {
  private current: SessionState = INITIAL_SESSION;
  private readonly listeners = new Set<Listener>();
  private running = false;
  private generation = 0;
  private rfb: RfbLike | null = null;
  private screen: HTMLElement | null = null;
  private unwatchCanvas: (() => void) | null = null;
  private unwatchFocus: (() => void) | null = null;
  private timer: unknown = null;
  private abort: AbortController | null = null;
  private target: HTMLElement | null = null;
  private viewOnlyFlag = false;
  private fitFlag = true;
  private deps: SessionDeps | null;
  callbacks: SessionCallbacks = {};

  constructor(deps: SessionDeps | null) {
    this.deps = deps;
  }

  get state(): SessionState {
    return this.current;
  }

  get viewOnly(): boolean {
    return this.viewOnlyFlag;
  }

  get canvas(): HTMLCanvasElement | null {
    return this.screen?.querySelector("canvas") ?? null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setDeps(deps: SessionDeps | null): void {
    this.deps = deps;
  }

  attach(target: HTMLElement): void {
    this.target = target;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.update({ attempt: 0 });
    void this.connect();
  }

  stop(): void {
    this.teardown();
    this.running = false;
    this.update({ phase: "idle", error: null, attempt: 0, retryAt: null });
  }

  reconnect(): void {
    this.teardown();
    this.running = true;
    this.update({ attempt: 0 });
    void this.connect();
  }

  dispose(): void {
    this.stop();
    this.removeGhost();
    this.listeners.clear();
  }

  setViewOnly(viewOnly: boolean): void {
    this.viewOnlyFlag = viewOnly;
    if (!this.rfb) return;
    this.rfb.viewOnly = viewOnly;
    if (viewOnly) this.rfb.blur();
  }

  setFit(fit: boolean): void {
    this.fitFlag = fit;
    if (this.rfb) this.rfb.scaleViewport = fit;
  }

  focus(): void {
    this.rfb?.focus({ preventScroll: true });
  }

  sendKeys(keysyms: readonly number[]): void {
    const rfb = this.rfb;
    if (!rfb || this.viewOnlyFlag || this.current.phase !== "connected") return;
    for (const keysym of keysyms) rfb.sendKey(keysym, null, true);
    for (const keysym of [...keysyms].reverse()) rfb.sendKey(keysym, null, false);
    this.focus();
  }

  pasteClipboard(text: string): void {
    if (this.current.phase !== "connected" || this.viewOnlyFlag) return;
    this.rfb?.clipboardPasteFrom(text);
  }

  private update(patch: Partial<SessionState>): void {
    this.current = { ...this.current, ...patch };
    this.listeners.forEach((listener) => listener(this.current));
  }

  private now(): number {
    return (this.deps?.now ?? Date.now)();
  }

  private teardown(): void {
    this.generation += 1;
    if (this.timer !== null) {
      (this.deps?.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
      this.timer = null;
    }
    this.abort?.abort();
    this.abort = null;
    this.releaseRfb();
  }

  private releaseRfb(): void {
    const rfb = this.rfb;
    this.rfb = null;
    this.stopWatchingCanvas();
    this.stopWatchingFocus();
    if (!rfb) return;
    try {
      rfb.disconnect();
    } catch {
      return;
    }
    this.keepLastFrame();
  }

  private keepLastFrame(): void {
    const screen = this.screen;
    if (!screen || !this.target || this.target.contains(screen)) return;
    this.removeGhost();
    screen.setAttribute(GHOST_ATTRIBUTE, "");
    this.target.appendChild(screen);
  }

  private removeGhost(): void {
    this.target?.querySelectorAll(`[${GHOST_ATTRIBUTE}]`).forEach((ghost) => ghost.remove());
  }

  private async connect(): Promise<void> {
    const generation = ++this.generation;
    const stale = () => generation !== this.generation;
    this.update({ phase: "connecting", retryAt: null });
    const deps = this.deps;
    const target = this.target;
    if (!deps || !target) {
      this.update({ phase: "failed", error: ERROR_MESSAGES.notConfigured });
      return;
    }
    const abort = new AbortController();
    this.abort = abort;
    let status: DisplayStatus;
    let ticket: string;
    try {
      status = await deps.fetchStatus(abort.signal);
      if (stale()) return;
      this.update({ status });
      if (!isDisplayReady(status)) {
        this.update({ phase: "unavailable" });
        return;
      }
      ticket = await deps.createTicket(abort.signal);
    } catch (error) {
      if (stale()) return;
      if (deps.isAuthError(error)) this.update({ phase: "failed", error: deps.describeError(error) });
      else this.scheduleRetry(deps.describeError(error));
      return;
    }
    if (stale()) return;
    let rfb: RfbLike;
    try {
      rfb = await deps.createRfb(target, () => deps.openChannel(ticket), { wsProtocols: [...VNC_WS_PROTOCOLS], shared: true });
    } catch (error) {
      if (!stale()) this.scheduleRetry(deps.describeError(error));
      return;
    }
    if (stale()) {
      rfb.disconnect();
      return;
    }
    this.rfb = rfb;
    this.screen = target.lastElementChild instanceof HTMLElement && !target.lastElementChild.hasAttribute(GHOST_ATTRIBUTE) ? target.lastElementChild : null;
    this.configure(rfb);
    this.listen(rfb, status, generation);
  }

  private configure(rfb: RfbLike): void {
    rfb.scaleViewport = this.fitFlag;
    rfb.clipViewport = false;
    rfb.resizeSession = false;
    rfb.showDotCursor = false;
    rfb.viewOnly = this.viewOnlyFlag;
    rfb.background = "transparent";
    rfb.compressionLevel = VNC_COMPRESSION_LEVEL;
    rfb.qualityLevel = VNC_QUALITY_LEVEL;
    this.watchFocus(rfb);
  }

  private watchFocus(rfb: RfbLike): void {
    this.stopWatchingFocus();
    const canvas = this.canvas;
    if (!canvas) return;
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (this.rfb !== rfb || this.viewOnlyFlag || (next && canvas.contains(next))) return;
      rfb.viewOnly = true;
      rfb.viewOnly = this.viewOnlyFlag;
    };
    canvas.addEventListener("focusout", onFocusOut);
    this.unwatchFocus = () => canvas.removeEventListener("focusout", onFocusOut);
  }

  private stopWatchingFocus(): void {
    this.unwatchFocus?.();
    this.unwatchFocus = null;
  }

  private listen(rfb: RfbLike, status: DisplayStatus, generation: number): void {
    const live = () => generation === this.generation && this.rfb === rfb;
    rfb.addEventListener("connect", () => {
      if (!live()) return;
      this.removeGhost();
      this.update({ phase: "connected", attempt: 0, error: null, retryAt: null, ...this.frameSize() });
      this.watchCanvas();
    });
    rfb.addEventListener("credentialsrequired", () => {
      if (!live()) return;
      this.update({ phase: "authenticating" });
      const password = status.vnc.password;
      if (password) rfb.sendCredentials({ password });
      else this.failAuth(SESSION_ERRORS.needsPassword);
    });
    rfb.addEventListener("securityfailure", (event) => {
      if (!live()) return;
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
      this.failAuth(reason || SESSION_ERRORS.authFailed);
    });
    rfb.addEventListener("desktopname", (event) => {
      if (!live()) return;
      this.update({ name: (event as CustomEvent<{ name?: string }>).detail?.name ?? "" });
    });
    rfb.addEventListener("clipboard", (event) => {
      if (!live()) return;
      this.callbacks.onClipboard?.((event as CustomEvent<{ text?: string }>).detail?.text ?? "");
    });
    rfb.addEventListener("disconnect", () => {
      if (!live()) return;
      this.rfb = null;
      this.stopWatchingCanvas();
      this.stopWatchingFocus();
      this.keepLastFrame();
      const phase = this.current.phase;
      if (phase === "auth_failed" || phase === "failed") return;
      if (phase === "authenticating") {
        this.generation += 1;
        this.update({ phase: "auth_failed", error: null });
        return;
      }
      this.scheduleRetry(phase === "connected" ? null : SESSION_ERRORS.socketFailed);
    });
  }

  private frameSize(): Partial<Pick<SessionState, "width" | "height">> {
    const canvas = this.canvas;
    return canvas && canvas.width > 0 && canvas.height > 0 ? { width: canvas.width, height: canvas.height } : {};
  }

  private watchCanvas(): void {
    const canvas = this.canvas;
    this.stopWatchingCanvas();
    if (!canvas) return;
    const onRestored = () => {
      if (this.current.phase === "connected") this.reconnect();
    };
    canvas.addEventListener("contextrestored", onRestored);
    const observer =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            const size = this.frameSize();
            if (size.width !== this.current.width || size.height !== this.current.height) this.update(size);
          });
    observer?.observe(canvas, { attributes: true, attributeFilter: ["width", "height"] });
    this.unwatchCanvas = () => {
      canvas.removeEventListener("contextrestored", onRestored);
      observer?.disconnect();
    };
  }

  private stopWatchingCanvas(): void {
    this.unwatchCanvas?.();
    this.unwatchCanvas = null;
  }

  private failAuth(error: string): void {
    this.generation += 1;
    this.update({ phase: "auth_failed", error });
    this.releaseRfb();
  }

  private scheduleRetry(error: string | null): void {
    if (!this.running) return;
    this.releaseRfb();
    const deps = this.deps;
    const delaySeconds = backoffDelay(this.current.attempt, deps?.random);
    const generation = ++this.generation;
    this.update({ phase: "retrying", error, attempt: this.current.attempt + 1, retryAt: this.now() + delaySeconds * 1000 });
    const setTimer = deps?.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
    this.timer = setTimer(() => {
      this.timer = null;
      if (generation === this.generation && this.running) void this.connect();
    }, delaySeconds * 1000);
  }
}

