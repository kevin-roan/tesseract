import type { TesseractBridge } from "../shared/ipc";

declare global {
  interface Window {
    tesseract?: TesseractBridge;
    __tesseractIdle?: () => Promise<boolean>;
  }
}

export {};
