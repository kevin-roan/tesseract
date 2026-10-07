import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { app, clipboard, dialog, net, type BrowserWindow } from "electron";
import { contentLength, expectedSha, FILES_LABELS, streamToFile } from "../../core/files";
import type { FileDownloadRequest, FileSaveResult } from "../../shared/contracts/files";
import { IpcError } from "../../shared/ipc-types";
import { defineService, type HandlerContext } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const NOT_FOUND = 404;
const events = serviceEmitter("files");
const inflight = new Map<string, AbortController>();

function safeName(name: unknown): string {
  if (typeof name !== "string" || !basename(name).trim()) throw new IpcError("invalid_argument", FILES_LABELS.invalidName);
  return basename(name);
}

function validUrl(raw: unknown): string {
  let url: URL;
  try {
    url = new URL(String(raw));
  } catch {
    throw new IpcError("invalid_argument", FILES_LABELS.invalidUrl);
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new IpcError("forbidden", FILES_LABELS.invalidUrl);
  return url.toString();
}

async function errorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    return typeof body.error?.message === "string" && body.error.message ? body.error.message : null;
  } catch {
    return null;
  }
}

async function chooseTarget(window: BrowserWindow | null, suggestedName: string): Promise<string | null> {
  const options = { defaultPath: join(app.getPath("downloads"), suggestedName) };
  const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
  return result.canceled || !result.filePath ? null : result.filePath;
}

async function download(context: HandlerContext, id: string, request: FileDownloadRequest): Promise<FileSaveResult | null> {
  const url = validUrl(request.url);
  const path = await chooseTarget(context.window, safeName(request.suggestedName));
  if (!path) return null;
  const controller = new AbortController();
  inflight.set(id, controller);
  try {
    const response = await net.fetch(url, { headers: request.headers, signal: controller.signal, bypassCustomProtocolHandlers: true });
    if (!response.ok || !response.body) {
      const code = response.status === NOT_FOUND ? "not_found" : "unavailable";
      throw new IpcError(code, (await errorMessage(response)) ?? FILES_LABELS.http(response.status, response.statusText));
    }
    const total = contentLength(response.headers);
    events.emit("progress", { id, received: 0, total });
    await streamToFile({
      body: response.body,
      path,
      expectedSha256: expectedSha(response.headers, request.expectedSha256, request.useHeaderChecksum),
      onProgress: (received) => events.emit("progress", { id, received, total }),
    });
    return { path, name: basename(path) };
  } catch (error) {
    if (controller.signal.aborted) throw new IpcError("cancelled", FILES_LABELS.cancelled);
    throw error;
  } finally {
    inflight.delete(id);
  }
}

export default defineService(
  "files",
  {
    download: (context, id, request) => download(context, String(id), request),
    saveBytes: async (context, suggestedName, dataBase64) => {
      const path = await chooseTarget(context.window, safeName(suggestedName));
      if (!path) return null;
      await writeFile(path, Buffer.from(String(dataBase64), "base64"));
      return { path, name: basename(path) };
    },
    cancel: (_context, id) => {
      inflight.get(String(id))?.abort();
    },
    readClipboard: () => clipboard.readText(),
    writeClipboard: (_context, text) => {
      clipboard.writeText(String(text));
    },
  },
  {
    start: () => () => {
      for (const controller of inflight.values()) controller.abort();
      inflight.clear();
    },
  },
);
