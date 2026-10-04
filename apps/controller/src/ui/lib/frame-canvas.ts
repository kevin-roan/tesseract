type Size = { width: number; height: number };

const JPEG_TYPE = "image/jpeg";

type Decoded = { image: CanvasImageSource; width: number; height: number; release: () => void };

function decodeWithImage(blob: Blob): Promise<Decoded> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve({ image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode a frame"));
    };
    image.src = url;
  });
}

async function decode(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {}
  }
  return decodeWithImage(blob);
}

/**
 * Draws JPEG frames on a canvas letterboxed into its container. Only the newest pending
 * frame is decoded; every decoded image is released right after drawing.
 */
export class FrameCanvas {
  private readonly context: CanvasRenderingContext2D;
  private pending: Blob | null = null;
  private decoding = false;
  private size: Size | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is not available");
    this.context = context;
    if (typeof ResizeObserver === "function") new ResizeObserver(() => this.layout()).observe(container);
    window.addEventListener("resize", () => this.layout());
  }

  /** The remote screen size that pointer coordinates are reported in. */
  get screenSize(): Size | null {
    return this.size;
  }

  setScreenSize(size: Size): void {
    this.size = size;
    this.layout();
  }

  push(frame: ArrayBuffer): void {
    this.pending = new Blob([frame], { type: JPEG_TYPE });
    if (!this.decoding) void this.drain();
  }

  /** Client coordinates → remote screen coordinates, clamped to the screen. */
  toScreen(clientX: number, clientY: number): { x: number; y: number } | null {
    const size = this.size;
    const rect = this.canvas.getBoundingClientRect();
    if (!size || rect.width <= 0 || rect.height <= 0) return null;
    const x = ((clientX - rect.left) / rect.width) * size.width;
    const y = ((clientY - rect.top) / rect.height) * size.height;
    return { x: Math.min(Math.max(x, 0), size.width - 1), y: Math.min(Math.max(y, 0), size.height - 1) };
  }

  layout(): void {
    const size = this.size;
    if (!size) return;
    const style = getComputedStyle(this.container);
    const width = this.container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = this.container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (width <= 0 || height <= 0) return;
    const scale = Math.min(width / size.width, height / size.height);
    this.canvas.style.width = `${Math.floor(size.width * scale)}px`;
    this.canvas.style.height = `${Math.floor(size.height * scale)}px`;
  }

  private async drain(): Promise<void> {
    this.decoding = true;
    while (this.pending) {
      const blob = this.pending;
      this.pending = null;
      let decoded: Decoded;
      try {
        decoded = await decode(blob);
      } catch {
        continue;
      }
      if (this.canvas.width !== decoded.width || this.canvas.height !== decoded.height) {
        this.canvas.width = decoded.width;
        this.canvas.height = decoded.height;
      }
      this.context.drawImage(decoded.image, 0, 0);
      decoded.release();
    }
    this.decoding = false;
  }
}
