import type { SttStatus } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import {
  isSttProfile,
  microphoneAccess,
  normalizeMicrophoneAccess,
  requestMicrophoneAccess,
  STT_PROFILE_ORDER,
  sttProfileAvailable,
  sttProfileInfo,
} from ".";

const STATUS: SttStatus = {
  profile: "eco",
  profiles: [
    { id: "off", model: null, threads: 0, nice: 0, available: true },
    { id: "eco", model: "base", threads: 2, nice: 19, available: true },
    { id: "balanced", model: "base", threads: 4, nice: 10, available: true },
    { id: "performance", model: "small", threads: 8, nice: 0, available: false },
  ],
  engine: "whisper.cpp",
  ready: true,
  reason: null,
  model: "base",
  cpus: 16,
  busy: false,
  queued: 0,
  gemini: { configured: false, model: "gemini-2.5-flash", source: null },
};

describe("microphone access", () => {
  it("is unknown on Linux and normalises unexpected values", () => {
    expect(microphoneAccess({ platform: "linux", status: () => "granted" })).toBe("unknown");
    expect(microphoneAccess({ platform: "win32", status: () => "granted" })).toBe("granted");
    expect(microphoneAccess({ platform: "darwin", status: () => "weird" })).toBe("unknown");
    expect(microphoneAccess({ platform: "darwin", status: () => { throw new Error("x"); } })).toBe("unknown");
    expect(normalizeMicrophoneAccess("restricted")).toBe("restricted");
  });

  it("asks on macOS only while undetermined", async () => {
    let status = "not-determined";
    let asked = 0;
    const probe = {
      platform: "darwin" as const,
      status: () => status,
      ask: async () => {
        asked += 1;
        status = "granted";
        return true;
      },
    };
    expect(await requestMicrophoneAccess(probe)).toBe("granted");
    expect(await requestMicrophoneAccess(probe)).toBe("granted");
    expect(asked).toBe(1);
    expect(await requestMicrophoneAccess({ platform: "win32", status: () => "denied", ask: probe.ask })).toBe("denied");
    expect(asked).toBe(1);
  });
});

describe("STT profiles", () => {
  it("follows the protocol order and availability", () => {
    expect(STT_PROFILE_ORDER).toEqual(["off", "eco", "balanced", "performance"]);
    expect(isSttProfile("eco")).toBe(true);
    expect(isSttProfile("turbo")).toBe(false);
    expect(sttProfileInfo(STATUS, "balanced")?.threads).toBe(4);
    expect(sttProfileAvailable(STATUS, "performance")).toBe(false);
    expect(sttProfileAvailable(null, "off")).toBe(true);
    expect(sttProfileAvailable(null, "eco")).toBe(false);
  });
});
