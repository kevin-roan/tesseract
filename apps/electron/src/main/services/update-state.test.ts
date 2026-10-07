import { describe, expect, it } from "vitest";
import type { UpdateState } from "../../shared/contracts/updates";
import { UPDATE_LABELS } from "../labels";
import { reduceUpdate, releaseNotes, unsupportedReason, type UpdateEnvironment } from "./update-state";

const packaged: UpdateEnvironment = { packaged: true, isTest: false, disabled: false, platform: "linux", appImage: true, linuxPackage: false };

describe("unsupportedReason", () => {
  it("turns updates off in development, tests and when disabled", () => {
    expect(unsupportedReason({ ...packaged, packaged: false })).toBe(UPDATE_LABELS.unsupportedDev);
    expect(unsupportedReason({ ...packaged, isTest: true })).toBe(UPDATE_LABELS.unsupportedDev);
    expect(unsupportedReason({ ...packaged, disabled: true })).toBe(UPDATE_LABELS.unsupportedDisabled);
  });

  it("supports AppImage and deb on Linux, and every mac/win build", () => {
    expect(unsupportedReason(packaged)).toBeNull();
    expect(unsupportedReason({ ...packaged, appImage: false, linuxPackage: true })).toBeNull();
    expect(unsupportedReason({ ...packaged, appImage: false })).toBe(UPDATE_LABELS.unsupportedPackage);
    expect(unsupportedReason({ ...packaged, platform: "darwin", appImage: false })).toBeNull();
    expect(unsupportedReason({ ...packaged, platform: "win32", appImage: false })).toBeNull();
  });
});

describe("reduceUpdate", () => {
  const idle: UpdateState = { kind: "idle", checkedAt: null };

  it("walks check → available → downloading → ready", () => {
    let state = reduceUpdate(idle, { type: "checking" });
    expect(state).toEqual({ kind: "checking" });
    state = reduceUpdate(state, { type: "available", version: "0.2.0", notes: null });
    state = reduceUpdate(state, { type: "progress", received: 5, total: 10, bytesPerSecond: 2 });
    expect(state).toEqual({ kind: "downloading", version: "0.2.0", progress: { received: 5, total: 10, bytesPerSecond: 2 } });
    state = reduceUpdate(state, { type: "downloaded", version: "0.2.0" });
    expect(state).toEqual({ kind: "ready", version: "0.2.0" });
  });

  it("keeps a downloaded update through later checks and errors", () => {
    const ready: UpdateState = { kind: "ready", version: "0.2.0" };
    expect(reduceUpdate(ready, { type: "checking" })).toBe(ready);
    expect(reduceUpdate(ready, { type: "error", message: "offline" })).toBe(ready);
    expect(reduceUpdate(ready, { type: "progress", received: 1, total: 2, bytesPerSecond: null })).toBe(ready);
  });

  it("ignores progress without a known version", () => {
    expect(reduceUpdate(idle, { type: "progress", received: 1, total: 2, bytesPerSecond: null })).toBe(idle);
  });

  it("records up-to-date checks and errors", () => {
    expect(reduceUpdate({ kind: "checking" }, { type: "not-available", at: "2026-10-07T00:00:00.000Z" })).toEqual({ kind: "up-to-date", checkedAt: "2026-10-07T00:00:00.000Z" });
    expect(reduceUpdate({ kind: "checking" }, { type: "error", message: "boom" })).toEqual({ kind: "error", message: "boom" });
  });
});

describe("releaseNotes", () => {
  it("flattens electron-updater note shapes", () => {
    expect(releaseNotes("Fixes")).toBe("Fixes");
    expect(releaseNotes("")).toBeNull();
    expect(releaseNotes([{ version: "1", note: "A" }, { version: "2", note: null }, { version: "3", note: "B" }])).toBe("A\n\nB");
    expect(releaseNotes(undefined)).toBeNull();
  });
});
