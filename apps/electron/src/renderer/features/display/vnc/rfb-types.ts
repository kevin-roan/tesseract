export interface RfbCredentials {
  username?: string;
  password?: string;
  target?: string;
}

export interface RfbOptions {
  shared?: boolean;
  credentials?: RfbCredentials;
  wsProtocols?: string[];
}

export interface RfbChannel {
  send(data: ArrayBuffer | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  binaryType: string;
  protocol: string;
  readyState: number | string;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
}

export interface RfbLike extends EventTarget {
  viewOnly: boolean;
  focusOnClick: boolean;
  clipViewport: boolean;
  scaleViewport: boolean;
  resizeSession: boolean;
  showDotCursor: boolean;
  background: string;
  qualityLevel: number;
  compressionLevel: number;
  disconnect(): void;
  sendCredentials(credentials: RfbCredentials): void;
  sendKey(keysym: number, code: string | null, down?: boolean): void;
  focus(options?: FocusOptions): void;
  blur(): void;
  clipboardPasteFrom(text: string): void;
}

export type RfbFactory = (target: HTMLElement, open: () => string | RfbChannel, options: RfbOptions) => Promise<RfbLike>;
