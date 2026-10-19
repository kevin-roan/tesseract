import type { TesseractClient } from "@tesseract/client";
import type { HostAndroidStatus, HostIosStatus } from "@tesseract/protocol";

import type { HostDeviceKind, HostScreenTarget } from "../types";
import { androidScreenMaxSize } from "./android";
import { ANDROID_COPY, IOS_COPY } from "./content";

export type HostDeviceSpec = {
  title: string;
  route: "/host/android" | "/host/ios";
  maxSize: (width: number, height: number, scale: number) => number;
  pageUrl: (client: TesseractClient, maxSize: number, serial?: string) => Promise<string>;
};

/** Screen-streamed devices of the host daemon; `serial` is an adb serial on Android and a simulator UDID on iOS. */
export const HOST_DEVICES: Record<HostDeviceKind, HostDeviceSpec | null> = {
  android: {
    title: ANDROID_COPY.screenTitle,
    route: "/host/android",
    maxSize: androidScreenMaxSize,
    pageUrl: (client, maxSize, serial) => client.androidScreenPageUrl(maxSize, serial),
  },
  ios: {
    title: IOS_COPY.screenTitle,
    route: "/host/ios",
    maxSize: androidScreenMaxSize,
    pageUrl: (client, maxSize, serial) => client.iosScreenPageUrl(maxSize, serial),
  },
};

export const isHostDeviceKind = (value: unknown): value is HostDeviceKind => value === "android" || value === "ios";

/** The device screen to return to after unlocking, from the `next` and `serial` route params. */
export function screenTargetFrom(next: unknown, serial: unknown): HostScreenTarget | null {
  if (!isHostDeviceKind(next)) return null;
  return typeof serial === "string" && serial.length > 0 ? { kind: next, serial } : { kind: next };
}

/** Both kinds are offered once the host answers the iOS status (hosts from before iOS support only offer Android). */
export const offersBothKinds = (ios: HostIosStatus | undefined): boolean => ios !== undefined;

/** The picked kind, else iOS when only the Simulator is available, else Android. */
export function deviceKindFor(
  picked: HostDeviceKind | null,
  android: HostAndroidStatus | undefined,
  ios: HostIosStatus | undefined,
): HostDeviceKind {
  if (!offersBothKinds(ios)) return "android";
  if (picked) return picked;
  return android?.available === false && ios?.available === true ? "ios" : "android";
}
