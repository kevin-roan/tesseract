import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { RENDERER_FILE } from "./config";

export function rendererEntryFile(): string {
  return join(import.meta.dirname, RENDERER_FILE);
}

export function rendererEntryUrl(): string {
  return pathToFileURL(rendererEntryFile()).href;
}
