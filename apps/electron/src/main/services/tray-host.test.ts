import { describe, expect, it } from "vitest";
import { isWatcherOwnerChange, parseHasOwner } from "./tray-host";

describe("tray host detection", () => {
  it("reads the NameHasOwner reply", () => {
    expect(parseHasOwner("(true,)\n")).toBe(true);
    expect(parseHasOwner("(false,)\n")).toBe(false);
    expect(parseHasOwner("")).toBe(false);
  });

  it("spots owner changes of the StatusNotifierWatcher only", () => {
    expect(isWatcherOwnerChange("/org/freedesktop/DBus: org.freedesktop.DBus.NameOwnerChanged ('org.kde.StatusNotifierWatcher', '', ':1.42')")).toBe(true);
    expect(isWatcherOwnerChange("/org/freedesktop/DBus: org.freedesktop.DBus.NameOwnerChanged (':1.9', ':1.9', '')")).toBe(false);
    expect(isWatcherOwnerChange("/org/freedesktop/DBus: org.freedesktop.DBus.NameAcquired ('org.kde.StatusNotifierWatcher',)")).toBe(false);
  });
});
