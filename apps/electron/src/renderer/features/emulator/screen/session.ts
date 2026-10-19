import type { SocketLike } from "@tesseract/client";
import { INITIAL_SCREEN, SCREEN_CODEC_H264, SCREEN_MIME, SCREEN_QUERY } from "../constants";
import type { ScreenClientMessage, ScreenRequest, ScreenServerMessage, ScreenSpec, ScreenState } from "../types";
import { canDecodeH264, H264Decoder } from "./h264";
import { keyMessage, PointerSlots, textMessages, toScreenPoint, wheelSteps, type KeyEventLike, type WheelLike } from "./input";

export interface ScreenSocket extends SocketLike {
  binaryType?: string;
}

export interface DecodedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

export interface FrameDecoder {
  push(message: ArrayBuffer): void;
  close(): void;
}

export interface ScreenSessionDeps {
  openSocket(path: string, query: URLSearchParams): Promise<ScreenSocket>;
  canDecodeH264?(): Promise<boolean>;
  createDecoder?(onFrame: (frame: VideoFrame) => void, onError: (message: string) => void): FrameDecoder;
  decodeImage?(blob: Blob): Promise<DecodedImage>;
}

export interface PointerLike {
  pointerId: number;
  clientX: number;
  clientY: number;
}

async function decodeBitmap(blob: Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(blob);
  return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
}

function parseMessage(text: string): ScreenServerMessage | null {
  try {
    const value = JSON.parse(text) as { type?: unknown };
    return value && typeof value.type === "string" ? (value as ScreenServerMessage) : null;
  } catch {
    return null;
  }
}

export class ScreenSession {
  state: ScreenState = INITIAL_SCREEN;
  private readonly listeners = new Set<() => void>();
  private readonly pointers: PointerSlots;
  private socket: ScreenSocket | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private decoder: FrameDecoder | null = null;
  private pending: Blob | null = null;
  private decoding = false;
  private h264Failed = false;
  private generation = 0;
  private disposed = false;

  constructor(
    private readonly spec: ScreenSpec,
    private readonly deps: ScreenSessionDeps,
  ) {
    this.pointers = new PointerSlots(spec.maxPointers);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  attach(canvas: HTMLCanvasElement | null): void {
    this.canvas = canvas;
  }

  async connect(request: ScreenRequest): Promise<void> {
    if (this.disposed) return;
    this.close();
    const generation = (this.generation += 1);
    this.set({ status: "connecting", error: null });
    const query = new URLSearchParams();
    if (request.device) query.set(this.spec.deviceParam, request.device);
    const h264 = this.spec.h264 && !this.h264Failed && (await (this.deps.canDecodeH264 ?? canDecodeH264)());
    if (h264) query.set(SCREEN_QUERY.codec, SCREEN_CODEC_H264);
    let socket: ScreenSocket;
    try {
      socket = await this.deps.openSocket(this.spec.path, query);
    } catch (error) {
      if (generation === this.generation) this.set({ status: "error", error: error instanceof Error ? error.message : String(error) });
      return;
    }
    if (generation !== this.generation || this.disposed) {
      socket.close();
      return;
    }
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    let serverError: string | null = null;
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      const data = event.data;
      if (data instanceof ArrayBuffer) this.frame(data);
      else if (typeof data === "string") serverError = this.receive(parseMessage(data)) ?? serverError;
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.reset();
      this.set(serverError ? { status: "error", error: serverError } : { status: "disconnected", error: event.reason || null });
    };
  }

  disconnect(): void {
    this.generation += 1;
    this.close();
    this.set({ ...INITIAL_SCREEN });
  }

  dispose(): void {
    this.disposed = true;
    this.disconnect();
    this.listeners.clear();
  }

  send(message: ScreenClientMessage): void {
    if (this.socket && this.socket.readyState === 1) this.socket.send(JSON.stringify(message));
  }

  pointerDown(event: PointerLike): boolean {
    const slot = this.pointers.acquire(event.pointerId);
    if (slot === null) return false;
    this.touch("down", slot, event);
    return true;
  }

  pointerMove(event: PointerLike): void {
    const slot = this.pointers.get(event.pointerId);
    if (slot !== null) this.touch("move", slot, event);
  }

  pointerUp(event: PointerLike, cancel = false): void {
    const slot = this.pointers.release(event.pointerId);
    if (slot !== null) this.touch(cancel ? "cancel" : "up", slot, event);
  }

  wheel(event: WheelLike & { clientX: number; clientY: number }): void {
    const point = this.point(event);
    if (!point) return;
    const { hscroll, vscroll } = wheelSteps(event, this.spec);
    if (hscroll || vscroll) this.send({ type: "scroll", ...point, hscroll, vscroll });
  }

  key(event: KeyEventLike): boolean {
    const message = keyMessage(event, this.spec);
    if (!message) return false;
    this.send(message);
    return true;
  }

  text(text: string): void {
    for (const message of textMessages(text, this.spec)) this.send(message);
  }

  private touch(action: "down" | "move" | "up" | "cancel", pointerId: number, event: PointerLike): void {
    const point = this.point(event);
    if (point) this.send({ type: "touch", action, pointerId, ...point, pressure: action === "up" || action === "cancel" ? 0 : 1 });
  }

  private point(event: { clientX: number; clientY: number }) {
    const canvas = this.canvas;
    return canvas ? toScreenPoint(canvas.getBoundingClientRect(), this.state.size, event.clientX, event.clientY) : null;
  }

  private receive(message: ScreenServerMessage | null): string | null {
    if (!message) return null;
    if (message.type === "error") return message.message;
    if (message.type === "meta") {
      this.closeDecoder();
      if (message.codec === SCREEN_CODEC_H264) {
        const create = this.deps.createDecoder ?? ((onFrame, onError) => new H264Decoder(onFrame, onError));
        this.decoder = create(
          (frame) => {
            this.draw(frame, frame.displayWidth, frame.displayHeight);
            frame.close();
          },
          (error) => this.decoderFailed(error),
        );
      }
      this.set({ status: "connected", title: message.deviceName || null, size: { width: message.width, height: message.height }, error: null });
      return null;
    }
    this.set({ size: { width: message.width, height: message.height } });
    return null;
  }

  private frame(data: ArrayBuffer): void {
    if (this.decoder) {
      this.decoder.push(data);
      return;
    }
    this.pending = new Blob([data], { type: SCREEN_MIME });
    if (!this.decoding) void this.drain();
  }

  private async drain(): Promise<void> {
    this.decoding = true;
    const decode = this.deps.decodeImage ?? decodeBitmap;
    while (this.pending) {
      const blob = this.pending;
      this.pending = null;
      try {
        const decoded = await decode(blob);
        this.draw(decoded.image, decoded.width, decoded.height);
        decoded.release();
      } catch {
        continue;
      }
    }
    this.decoding = false;
  }

  private draw(image: CanvasImageSource, width: number, height: number): void {
    const canvas = this.canvas;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.drawImage(image, 0, 0);
  }

  private decoderFailed(error: string): void {
    this.h264Failed = true;
    const socket = this.socket;
    this.socket = null;
    this.reset();
    socket?.close();
    this.set({ status: "error", error });
  }

  private closeDecoder(): void {
    this.decoder?.close();
    this.decoder = null;
  }

  private reset(): void {
    this.pointers.releaseAll();
    this.closeDecoder();
    this.pending = null;
  }

  private close(): void {
    const socket = this.socket;
    this.socket = null;
    this.reset();
    socket?.close();
  }

  private set(patch: Partial<ScreenState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
