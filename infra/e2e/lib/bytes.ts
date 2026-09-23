import { createHash } from "node:crypto";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface PngInfo {
  width: number;
  height: number;
}

export function sha256(data: ArrayBuffer | Uint8Array): string {
  return createHash("sha256").update(data instanceof Uint8Array ? data : new Uint8Array(data)).digest("hex");
}

export function readPng(data: ArrayBuffer): PngInfo {
  const bytes = new Uint8Array(data);
  if (bytes.length < 33 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw new Error("not a PNG: bad signature");
  }
  const view = new DataView(data);
  const chunk = new TextDecoder().decode(bytes.slice(12, 16));
  if (chunk !== "IHDR") throw new Error(`not a PNG: first chunk is ${chunk}`);
  const iend = new TextDecoder().decode(bytes.slice(bytes.length - 8, bytes.length - 4));
  if (iend !== "IEND") throw new Error("not a PNG: missing IEND");
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
