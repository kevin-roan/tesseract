import { describe, expect, it } from "vitest";
import { cliView, formatRelative, updateView } from "./model";

const NOW = Date.parse("2026-10-07T00:00:00Z");

describe("about model", () => {
  it("formats relative times", () => {
    expect(formatRelative("2026-10-06T23:59:30Z", NOW)).toBe("just now");
    expect(formatRelative("2026-10-06T23:48:00Z", NOW)).toBe("12 min ago");
    expect(formatRelative("2026-10-06T21:00:00Z", NOW)).toBe("3 h ago");
    expect(formatRelative("2026-10-05T12:00:00Z", NOW)).toBe("yesterday");
  });

  it("maps update states to a row", () => {
    expect(updateView({ kind: "idle", checkedAt: null }, NOW)).toMatchObject({ subtitle: "Not checked yet", action: "check" });
    expect(updateView({ kind: "up-to-date", checkedAt: "2026-10-06T23:48:00Z" }, NOW)).toMatchObject({
      subtitle: "Monolith is up to date · checked 12 min ago",
      actionLabel: "Check again",
    });
    expect(updateView({ kind: "available", version: "0.4.0", notes: "n" }, NOW)).toMatchObject({ action: "download", primary: true, notes: "n" });
    expect(updateView({ kind: "downloading", version: "0.4.0", progress: { received: 50e6, total: 100e6, bytesPerSecond: null } }, NOW)).toMatchObject({
      subtitle: "Downloading 0.4.0 · 50.0 MB of 100 MB · 50%",
      progress: 0.5,
      action: null,
    });
    expect(updateView({ kind: "ready", version: "0.4.0" }, NOW)).toMatchObject({ action: "install", actionLabel: "Restart to update" });
    expect(updateView({ kind: "unsupported", reason: "Dev build" }, NOW)).toMatchObject({ subtitle: "Dev build", action: null });
    expect(updateView({ kind: "error", message: "offline" }, NOW).subtitle).toBe("Couldn't check for updates: offline");
  });

  it("maps the CLI install state", () => {
    expect(cliView({ state: "installed", binaryPath: "/b", linkPath: "/usr/local/bin/tesseract", message: null })).toEqual({
      subtitle: "On your PATH at /usr/local/bin/tesseract",
      installed: true,
      canInstall: false,
    });
    expect(cliView({ state: "missing", binaryPath: "/b", linkPath: null, message: null }).canInstall).toBe(true);
    expect(cliView({ state: "unsupported", binaryPath: null, linkPath: null, message: null }).subtitle).toBe("Available in the installed app");
  });
});
