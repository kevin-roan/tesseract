import { MAX_UPLOAD_BYTES } from "./constants";

export * from "./constants";
export * from "./grants";
export * from "./labels";
export * from "./model";
export * from "./read";

export function maxUploadBytes(): number {
  return MAX_UPLOAD_BYTES;
}
