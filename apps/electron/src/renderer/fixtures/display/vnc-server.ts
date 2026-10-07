import { scenarioVncBehaviour, type FixtureVncBehaviour } from "./data";
import { renderScenePixels, SCENE_HEIGHT, SCENE_NAME, SCENE_WIDTH } from "./scene";

export type FixtureVncAuth = "none" | "vnc" | "reject";
export type FixtureVncTransport = "normal" | "hang" | "drop";

export interface FixtureVncOptions {
  auth?: FixtureVncAuth;
  width?: number;
  height?: number;
  name?: string;
  pixels?: () => Uint8ClampedArray;
  transport?: FixtureVncTransport;
}

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

const VERSION = "RFB 003.008\n";
const SECURITY_NONE = 1;
const SECURITY_VNC = 2;
const CHALLENGE_BYTES = 16;
const REJECT_REASON = "Authentication failure";
const DROP_CODE = 1006;

const CLIENT_MESSAGE_SIZE: Record<number, number> = { 0: 20, 3: 10, 4: 8, 5: 6 };
const SET_ENCODINGS = 2;
const FRAMEBUFFER_UPDATE_REQUEST = 3;
const CLIENT_CUT_TEXT = 6;

type Stage = "version" | "security" | "challenge" | "init" | "normal" | "closed";

function u16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0) & 0xff);
}

export class FixtureVncChannel {
  binaryType = "arraybuffer";
  protocol = "binary";
  readyState = CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  readonly received: number[][] = [];
  private queue: number[] = [];
  private stage: Stage = "version";
  private sentFrame = false;
  private readonly options: Required<FixtureVncOptions>;

  constructor(options: FixtureVncOptions = {}) {
    this.options = {
      auth: options.auth ?? "none",
      width: options.width ?? SCENE_WIDTH,
      height: options.height ?? SCENE_HEIGHT,
      name: options.name ?? SCENE_NAME,
      pixels: options.pixels ?? renderScenePixels,
      transport: options.transport ?? "normal",
    };
    if (this.options.transport === "hang") return;
    setTimeout(() => {
      if (this.readyState !== CONNECTING) return;
      this.readyState = OPEN;
      this.onopen?.(new Event("open"));
      if (this.options.transport === "drop") this.close(DROP_CODE);
      else this.emit(ascii(VERSION));
    }, 0);
  }

  send(data: ArrayBuffer | ArrayBufferView): void {
    if (this.readyState !== OPEN) return;
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    this.received.push(Array.from(bytes));
    this.queue.push(...bytes);
    this.process();
  }

  close(code = 1000, reason = ""): void {
    if (this.readyState === CLOSED) return;
    this.readyState = CLOSED;
    this.stage = "closed";
    setTimeout(() => this.onclose?.(new CloseEvent("close", { code, reason, wasClean: true })), 0);
  }

  private emit(bytes: number[] | Uint8Array): void {
    const payload = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    const buffer = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
    setTimeout(() => {
      if (this.readyState === OPEN) this.onmessage?.(new MessageEvent("message", { data: buffer }));
    }, 0);
  }

  private take(count: number): number[] | null {
    if (this.queue.length < count) return null;
    return this.queue.splice(0, count);
  }

  private process(): void {
    for (;;) {
      if (!this.step()) return;
    }
  }

  private step(): boolean {
    switch (this.stage) {
      case "version":
        if (!this.take(VERSION.length)) return false;
        this.stage = "security";
        this.emit([1, this.options.auth === "none" ? SECURITY_NONE : SECURITY_VNC]);
        return true;
      case "security": {
        const choice = this.take(1);
        if (!choice) return false;
        if (choice[0] === SECURITY_VNC) {
          this.stage = "challenge";
          this.emit(new Array(CHALLENGE_BYTES).fill(7));
        } else {
          this.stage = "init";
          this.emit(u32(0));
        }
        return true;
      }
      case "challenge":
        if (!this.take(CHALLENGE_BYTES)) return false;
        if (this.options.auth === "reject") {
          this.emit([...u32(1), ...u32(REJECT_REASON.length), ...ascii(REJECT_REASON)]);
          this.stage = "closed";
          return false;
        }
        this.stage = "init";
        this.emit(u32(0));
        return true;
      case "init":
        if (!this.take(1)) return false;
        this.stage = "normal";
        this.emit(this.serverInit());
        return true;
      case "normal":
        return this.clientMessage();
      case "closed":
        return false;
    }
  }

  private serverInit(): number[] {
    const { width, height, name } = this.options;
    const pixelFormat = [32, 24, 0, 1, ...u16(255), ...u16(255), ...u16(255), 16, 8, 0, 0, 0, 0];
    return [...u16(width), ...u16(height), ...pixelFormat, ...u32(name.length), ...ascii(name)];
  }

  private clientMessage(): boolean {
    const type = this.queue[0];
    if (type === undefined) return false;
    if (type === SET_ENCODINGS) {
      if (this.queue.length < 4) return false;
      const count = ((this.queue[2] ?? 0) << 8) | (this.queue[3] ?? 0);
      return this.take(4 + count * 4) !== null;
    }
    if (type === CLIENT_CUT_TEXT) {
      if (this.queue.length < 8) return false;
      const length = ((this.queue[4] ?? 0) << 24) | ((this.queue[5] ?? 0) << 16) | ((this.queue[6] ?? 0) << 8) | (this.queue[7] ?? 0);
      return this.take(8 + Math.abs(length)) !== null;
    }
    const size = CLIENT_MESSAGE_SIZE[type];
    if (size === undefined) {
      this.queue = [];
      return false;
    }
    if (!this.take(size)) return false;
    if (type === FRAMEBUFFER_UPDATE_REQUEST && !this.sentFrame) {
      this.sentFrame = true;
      this.emit(this.frame());
    }
    return true;
  }

  private frame(): Uint8Array {
    const { width, height } = this.options;
    const header = [0, 0, ...u16(1), ...u16(0), ...u16(0), ...u16(width), ...u16(height), ...u32(0)];
    const pixels = this.options.pixels();
    const message = new Uint8Array(header.length + width * height * 4);
    message.set(header, 0);
    message.set(pixels.subarray(0, width * height * 4), header.length);
    return message;
  }
}

export function createFixtureVncChannel(options: FixtureVncOptions = {}): FixtureVncChannel {
  return new FixtureVncChannel(options);
}

export function scenarioVncChannel(behaviour: FixtureVncBehaviour = scenarioVncBehaviour()): FixtureVncChannel {
  if (behaviour === "hang" || behaviour === "drop") return new FixtureVncChannel({ transport: behaviour });
  return new FixtureVncChannel({ auth: behaviour });
}
