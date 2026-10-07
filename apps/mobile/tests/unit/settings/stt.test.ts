import { sampleSttStatus } from "@theone/protocol/fixtures";

import { geminiKeyHint, geminiUnavailable, isSttProfile, isSttProvider, sttProfileRows, sttProviderRows } from "@/features/settings/utils/stt";
import { fallbackNotice } from "@/features/voice/utils/fallback";

const configured = { ...sampleSttStatus, gemini: { configured: true, model: "gemini-2.5-flash", source: "settings" as const } };

describe("speech-to-text settings", () => {
  it("recognises providers and profiles", () => {
    expect(isSttProvider("gemini")).toBe(true);
    expect(isSttProvider("native")).toBe(true);
    expect(isSttProvider("openai")).toBe(false);
    expect(isSttProfile("eco")).toBe(true);
    expect(isSttProfile("turbo")).toBe(false);
  });

  it("describes both providers and marks the selected one", () => {
    const [gemini, native] = sttProviderRows("gemini", configured);
    expect(gemini).toMatchObject({ id: "gemini", label: "Gemini", selected: true, value: undefined });
    expect(gemini.detail).toContain("gemini-2.5-flash");
    expect(gemini.detail).toContain("whisper.cpp");
    expect(native).toMatchObject({ id: "native", label: "Native", selected: false });
    expect(sttProviderRows("native", undefined)[1].selected).toBe(true);
    expect(sttProviderRows("gemini", undefined)[0].detail).toBeUndefined();
  });

  it("flags a sandbox without a Gemini key only when Gemini is chosen", () => {
    expect(sttProviderRows("gemini", sampleSttStatus)[0].value).toBe("No key");
    expect(geminiUnavailable("gemini", sampleSttStatus)).toBe(true);
    expect(geminiUnavailable("native", sampleSttStatus)).toBe(false);
    expect(geminiUnavailable("gemini", configured)).toBe(false);
    expect(geminiUnavailable("gemini", undefined)).toBe(false);
    expect(geminiKeyHint(sampleSttStatus)).toContain("aistudio.google.com");
    expect(geminiKeyHint(configured)).toContain("Paste a new one");
  });

  it("lists the native profiles with their availability", () => {
    const status = {
      ...sampleSttStatus,
      profiles: sampleSttStatus.profiles.map((profile) =>
        profile.id === "performance" ? { ...profile, available: false } : profile,
      ),
    };
    const rows = sttProfileRows(status, null);
    expect(rows.map((row) => row.label)).toEqual(["Off", "Eco", "Balanced", "Performance"]);
    expect(rows[0]).toMatchObject({ detail: "Native transcription is turned off", selected: false, disabled: false });
    expect(rows[1]).toMatchObject({ detail: "base model · 2 threads", selected: true, disabled: false });
    expect(rows[3]).toMatchObject({ value: "Not installed", disabled: true });
  });

  it("locks the profiles while one is being saved", () => {
    const rows = sttProfileRows(sampleSttStatus, "balanced");
    expect(rows[2].value).toBe("Saving…");
    expect(rows.every((row) => row.disabled)).toBe(true);
  });

  it("words the Gemini fallback notice", () => {
    expect(fallbackNotice(null)).toBeNull();
    expect(fallbackNotice("quota exhausted")).toBe("Gemini unavailable — used native transcription: quota exhausted");
  });
});
