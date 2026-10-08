import { sampleSttStatus } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { activityLabel, geminiSubtitle, profileChoices, stateLabel, statusRows } from "./model";

describe("stt preferences model", () => {
  it("renders the four profiles before load as unavailable", () => {
    const choices = profileChoices(null, false);
    expect(choices.map((choice) => choice.id)).toEqual(["off", "eco", "balanced", "performance"]);
    expect(choices.every((choice) => choice.available === false)).toBe(true);
    expect(choices[1]!.subtitle).toBe("Lowest impact: base model, 2 threads, idle CPU and disk priority");
  });

  it("adds model details and missing model lines", () => {
    const status = {
      ...sampleSttStatus,
      profiles: sampleSttStatus.profiles.map((info) => (info.id === "performance" ? { ...info, available: false } : info)),
    };
    const choices = profileChoices(status, false);
    expect(choices[0]!.subtitle).toBe("Voice notes are not transcribed");
    expect(choices[1]!.subtitle).toBe("Lowest impact: base model, 2 threads, idle CPU and disk priority\nbase · 2 threads · nice 19");
    expect(choices[3]!.subtitle).toBe(
      "Most accurate: small model, half the CPU cores, normal priority\nsmall · 4 threads\nModel not installed in the sandbox",
    );
    expect(choices.map((choice) => choice.available)).toEqual([true, true, true, false]);
    expect(profileChoices(status, true).every((choice) => !choice.available)).toBe(true);
  });

  it("describes the engine status", () => {
    expect(statusRows(sampleSttStatus)).toEqual([
      { key: "Engine", value: "whisper.cpp" },
      { key: "Model", value: "base" },
      { key: "State", value: "Ready" },
      { key: "Activity", value: "Idle" },
      { key: "CPU cores", value: "8" },
    ]);
    expect(stateLabel({ ...sampleSttStatus, ready: false, reason: "No model" })).toBe("Not ready · No model");
    expect(activityLabel({ ...sampleSttStatus, busy: true, queued: 2 })).toBe("Transcribing · 2 queued");
  });

  it("describes the gemini key source", () => {
    expect(geminiSubtitle(null)).toBe("");
    expect(geminiSubtitle(sampleSttStatus)).toBe("Not set · gemini-2.5-flash");
    expect(geminiSubtitle({ ...sampleSttStatus, gemini: { configured: true, model: "gemini-2.5-flash", source: "settings" } })).toBe(
      "Saved from an app · gemini-2.5-flash",
    );
  });
});
