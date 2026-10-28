import { DEFAULT_ANDROID_STREAM, DEFAULT_IOS_STREAM } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { maxSizeOptions, parseStreamDraft, streamChanges, streamDraft } from "./stream";

describe("stream settings", () => {
  it("round-trips saved settings through the draft", () => {
    const draft = streamDraft(DEFAULT_IOS_STREAM);
    expect(draft).toEqual({ encoding: "h264", bitRate: "6", maxFps: "60", maxSize: "auto", keyFrameInterval: "2", jpegQuality: "7" });
    expect(parseStreamDraft(draft)).toEqual({ ok: true, settings: DEFAULT_IOS_STREAM });
  });

  it("reads Mbit/s and a fixed size", () => {
    const parsed = parseStreamDraft({ ...streamDraft(DEFAULT_IOS_STREAM), bitRate: "2.5", maxSize: "1280", encoding: "mjpeg" });
    expect(parsed).toMatchObject({ ok: true, settings: { bitRate: 2_500_000, maxSize: 1280, encoding: "mjpeg" } });
  });

  it("rejects values outside the host limits", () => {
    const parsed = parseStreamDraft({ ...streamDraft(DEFAULT_IOS_STREAM), bitRate: "0.1", maxFps: "30.5", keyFrameInterval: "", jpegQuality: "40" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(Object.keys(parsed.errors).sort()).toEqual(["bitRate", "jpegQuality", "keyFrameInterval", "maxFps"]);
    expect(parsed.errors.bitRate).toBe("Bit rate (Mbit/s) must be between 0.25 and 50");
  });

  it("sends only the changed fields and never the Android device", () => {
    const next = { ...DEFAULT_IOS_STREAM, bitRate: DEFAULT_ANDROID_STREAM.bitRate, maxFps: 30 };
    expect(streamChanges(DEFAULT_ANDROID_STREAM, next)).toEqual({ maxFps: 30, jpegQuality: 7 });
    expect(streamChanges(DEFAULT_IOS_STREAM, DEFAULT_IOS_STREAM)).toEqual({});
  });

  it("offers auto, the presets and a custom saved size", () => {
    expect(maxSizeOptions(null)[0]).toEqual({ id: "auto", label: "Auto" });
    expect(maxSizeOptions(1000).map((option) => option.id)).toEqual(["auto", "720", "1000", "1080", "1280", "1600", "1920", "2560"]);
  });
});
