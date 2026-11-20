import { NativeModule, requireOptionalNativeModule, type EventSubscription } from "expo-modules-core";
import { TailnetStatusSchema, type TailnetStatus } from "@tesseract/protocol";

import type { TailnetEvents, TailnetStartOptions } from "./src/types";

export * from "./src/types";

declare class TesseractTailnetNative extends NativeModule<TailnetEvents> {
  isLinked(): boolean;
  start(options: TailnetStartOptions): Promise<void>;
  stop(): Promise<void>;
  logout(): Promise<void>;
  status(): Promise<string>;
  forward(host: string, port: number): Promise<number>;
  closeForward(host: string, port: number): Promise<void>;
}

const native = requireOptionalNativeModule<TesseractTailnetNative>("TesseractTailnet");
const linked = native?.isLinked() === true ? native : null;

const unavailable = (): never => {
  throw new Error("The Tesseract Network is not available in this build");
};

export const parseTailnetStatus = (json: string): TailnetStatus | null => {
  if (!json) return null;
  try {
    const parsed = TailnetStatusSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const isTailnetAvailable = (): boolean => linked !== null;

export const start = (options: TailnetStartOptions): Promise<void> => (linked ? linked.start(options) : unavailable());

export const stop = (): Promise<void> => (linked ? linked.stop() : Promise.resolve());

export const logout = (): Promise<void> => (linked ? linked.logout() : Promise.resolve());

export const status = async (): Promise<TailnetStatus | null> => (linked ? parseTailnetStatus(await linked.status()) : null);

export const forward = (host: string, port: number): Promise<number> => (linked ? linked.forward(host, port) : unavailable());

export const closeForward = (host: string, port: number): Promise<void> =>
  linked ? linked.closeForward(host, port) : Promise.resolve();

const noop: EventSubscription = { remove: () => undefined };

export const addStatusListener = (listener: (status: TailnetStatus) => void): EventSubscription =>
  linked
    ? linked.addListener("status", ({ json }) => {
        const parsed = parseTailnetStatus(json);
        if (parsed) listener(parsed);
      })
    : noop;
