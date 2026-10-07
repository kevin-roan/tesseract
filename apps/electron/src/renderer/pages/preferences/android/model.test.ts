import { describe, expect, it } from "vitest";
import type { AvdInfo } from "../../../../shared/contracts/android";
import type { PackageRow } from "../../../onboarding/android/model";
import { appendLine, deviceState, deviceSubtitle, emulatorBusy, installingPhase, licensesFor } from "./model";

const avd: AvdInfo = { name: "Monolith_API_36", path: "/avd/Monolith_API_36.avd", target: "android-36", abi: "x86_64" };

describe("android settings model", () => {
  it("describes devices", () => {
    expect(deviceSubtitle(avd)).toBe("Android 16 (API 36) · x86_64");
    expect(deviceSubtitle({ ...avd, target: null, abi: null })).toBe("Unknown system image");
  });

  it("maps the emulator state onto each device", () => {
    expect(deviceState(avd, null)).toBe("idle");
    expect(deviceState(avd, { kind: "running", avd: avd.name, serial: "emulator-5554" })).toBe("running");
    expect(deviceState(avd, { kind: "running", avd: "Other", serial: "emulator-5554" })).toBe("idle");
    expect(deviceState(avd, { kind: "failed", message: "x" })).toBe("idle");
    expect(emulatorBusy({ kind: "starting", avd: "x", since: 0 })).toBe(true);
    expect(emulatorBusy({ kind: "stopped" })).toBe(false);
  });

  it("turns progress events into an installing phase", () => {
    expect(installingPhase(null, 3)).toMatchObject({ kind: "installing", index: 0, count: 3 });
    const progress = { pkg: "emulator", index: 1, count: 3, stage: "verifying" as const, received: 5, total: 10, bytesPerSecond: null };
    expect(installingPhase(progress, 3)).toEqual({ kind: "installing", ...progress });
  });

  it("lists each pending license once", () => {
    const row = (licenseId: string | null) => ({ licenseId }) as PackageRow;
    expect(licensesFor([row("a"), row("a"), row(null), row("b")], new Set(["b"]))).toEqual(["a"]);
  });

  it("caps the log", () => {
    const lines = Array.from({ length: 200 }, (_, index) => String(index));
    expect(appendLine(lines, "x")).toHaveLength(200);
  });
});
