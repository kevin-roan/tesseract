import { LIMITS, type AgentRunEvent, type Upload } from "@tesseract/protocol";
import { sampleUpload } from "@tesseract/protocol/fixtures";

import {
  admitFiles,
  decodedLength,
  defaultPromptFor,
  fileNameOf,
  formatBytes,
  mimeTypeOr,
  uploadKindOf,
} from "@/features/attachments/utils/files";
import { formatClock, lastText, partitionAttachments, toChatEvents } from "@/features/chat/utils/messages";
import { activityLine, formatTimer, modelLabel, toTranscript } from "@/features/chat/utils/transcript";
import { AGENT_MODE_OPTIONS, isAgentMode } from "@/features/chat/utils/modes";
import {
  formatDuration,
  normalizeMetering,
  padLevels,
  pushLevel,
  resampleLevels,
  seededLevels,
  voiceFileName,
  voiceMimeType,
} from "@/features/voice/utils/levels";
import { MIN_LEVEL } from "@/features/voice/utils/constants";

const TS = "2026-09-23T10:00:00.000Z";
const file = (name: string, sizeBytes: number | null = 10) => ({ uri: `file:///${name}`, name, mimeType: "image/png", sizeBytes });

describe("attachment utils", () => {
  it("classifies mime types into upload kinds", () => {
    expect(uploadKindOf("image/heic")).toBe("image");
    expect(uploadKindOf("audio/mp4")).toBe("audio");
    expect(uploadKindOf("application/pdf")).toBe("pdf");
    expect(uploadKindOf("text/plain")).toBe("file");
    expect(mimeTypeOr(undefined)).toBe("application/octet-stream");
    expect(mimeTypeOr("image/png")).toBe("image/png");
  });

  it("formats sizes and names", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
    expect(fileNameOf("file:///a/b/My%20Photo.jpg?x=1", "fallback")).toBe("My Photo.jpg");
    expect(fileNameOf("", "fallback")).toBe("fallback");
    expect(decodedLength("aGVsbG8=")).toBe(5);
  });

  it("admits files within the size and count limits", () => {
    const big = file("big.png", LIMITS.maxUploadBytes + 1);
    const result = admitFiles([file("a.png"), big, file("b.png")], LIMITS.maxRunAttachments - 1);
    expect(result.accepted.map((entry) => entry.name)).toEqual(["a.png"]);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0]).toMatch(/big\.png is larger than 20 MB/);
    expect(result.rejected[1]).toMatch(/up to 10 files/);
    expect(admitFiles([file("unknown", null)], 0).accepted).toHaveLength(1);
  });

  it("picks a default prompt that matches the attachments", () => {
    expect(defaultPromptFor([{ kind: "image" }])).toBe("Take a look at this image.");
    expect(defaultPromptFor([{ kind: "image" }, { kind: "image" }])).toBe("Take a look at these images.");
    expect(defaultPromptFor([{ kind: "pdf" }])).toBe("Take a look at the attached file.");
    expect(defaultPromptFor([{ kind: "image" }, { kind: "pdf" }])).toBe("Take a look at the attached files.");
  });
});

describe("chat utils", () => {
  it("offers the three protocol modes", () => {
    expect(AGENT_MODE_OPTIONS.map((option) => [option.id, option.label])).toEqual([
      ["plan", "Plan"],
      ["acceptEdits", "Edit"],
      ["bypassPermissions", "Auto"],
    ]);
    expect(isAgentMode("plan")).toBe(true);
    expect(isAgentMode("yolo")).toBe(false);
  });

  it("shows an assistant header at the start and whenever text follows a tool", () => {
    const events: AgentRunEvent[] = [
      { kind: "text", seq: 1, ts: TS, text: "a" },
      { kind: "text", seq: 2, ts: TS, text: "b" },
      { kind: "tool_use", seq: 3, ts: TS, tool: "Bash", summary: "ls" },
      { kind: "text", seq: 4, ts: TS, text: "c" },
    ];
    expect(toChatEvents(events).map((item) => item.showHeader)).toEqual([true, false, false, true]);
  });

  it("folds tool calls between replies into activity blocks", () => {
    const at = (second: number) => new Date(Date.parse(TS) + second * 1000).toISOString();
    const events: AgentRunEvent[] = [
      { kind: "system", seq: 1, ts: at(1), text: "Session started (model claude-opus-5-5, cwd /workspace)" },
      { kind: "tool_use", seq: 2, ts: at(2), tool: "Bash", summary: "ls" },
      { kind: "text", seq: 3, ts: at(10), text: "Done." },
      { kind: "tool_use", seq: 4, ts: at(12), tool: "Read", summary: "a.ts" },
      { kind: "system", seq: 5, ts: at(20), text: "Run finished in 20 s" },
    ];
    const done = toTranscript(events, { startedAt: TS, endedAt: at(20), running: false });
    expect(done.map((block) => [block.kind, block.key])).toEqual([
      ["activity", "activity-0"],
      ["text", "text-3"],
      ["activity", "activity-3"],
    ]);
    expect(done[0]).toMatchObject({ startedAt: TS, endedAt: at(10) });
    expect(done[2]).toMatchObject({ startedAt: at(10), endedAt: at(20) });

    const live = toTranscript(events.slice(0, 3), { startedAt: TS, endedAt: null, running: true });
    expect(live.at(-1)).toMatchObject({ kind: "activity", key: "activity-3", events: [], endedAt: null });
    expect(activityLine(events.slice(0, 2))).toBe("Bash · ls");
    expect(activityLine([])).toBeNull();
    expect(modelLabel(events)).toBe("Opus 5.5");
    expect(modelLabel([{ kind: "system", seq: 1, ts: TS, text: "model claude-haiku-4-5-20251001" }])).toBe("Haiku 4.5");
    expect(modelLabel([])).toBeNull();
    expect([formatTimer(4), formatTimer(750), formatTimer(3723)]).toEqual(["00:04", "12:30", "1:02:03"]);
  });

  it("leaves the closing run summary to the brief and finds the last reply", () => {
    const events: AgentRunEvent[] = [
      { kind: "system", seq: 1, ts: TS, text: "Session started (model claude-opus-5-5, cwd /workspace)" },
      { kind: "text", seq: 2, ts: TS, text: "Done." },
      { kind: "tool_use", seq: 3, ts: TS, tool: "Bash", summary: "ls" },
      { kind: "system", seq: 4, ts: TS, text: "Run finished in 1.9 s, 1 turns, 142,260 tokens" },
    ];
    expect(toChatEvents(events).map((item) => item.event.seq)).toEqual([1, 2, 3]);
    expect(toChatEvents([{ kind: "system", seq: 1, ts: TS, text: "Run cancelled" }])).toEqual([]);
    expect(lastText(events)).toBe("Done.");
    expect(lastText([])).toBeNull();
  });

  it("formats a 12-hour clock", () => {
    const at = (hours: number, minutes: number) => new Date(2026, 8, 23, hours, minutes).toISOString();
    expect(formatClock(at(11, 28))).toBe("11:28am");
    expect(formatClock(at(0, 5))).toBe("12:05am");
    expect(formatClock(at(15, 0))).toBe("3:00pm");
    expect(formatClock("nope")).toBe("");
  });

  it("splits run attachments into the voice note, images and other files", () => {
    const audio: Upload = { ...sampleUpload, id: "upl_audio00001", kind: "audio", mimeType: "audio/mp4" };
    const pdf: Upload = { ...sampleUpload, id: "upl_pdf0000001", kind: "pdf", mimeType: "application/pdf" };
    expect(partitionAttachments([sampleUpload, audio, pdf])).toEqual({ audio, images: [sampleUpload], files: [pdf] });
    expect(partitionAttachments([]).audio).toBeNull();
  });
});

describe("voice utils", () => {
  it("normalises metering into a bar level", () => {
    expect(normalizeMetering(0)).toBe(1);
    expect(normalizeMetering(-30)).toBeCloseTo(0.5);
    expect(normalizeMetering(-120)).toBe(MIN_LEVEL);
    expect(normalizeMetering(undefined)).toBe(MIN_LEVEL);
  });

  it("keeps, pads and resamples level histories", () => {
    expect(pushLevel([0.1, 0.2], 0.3, 2)).toEqual([0.2, 0.3]);
    expect(padLevels([0.5], 3)).toEqual([MIN_LEVEL, MIN_LEVEL, 0.5]);
    expect(padLevels([0.1, 0.2, 0.3], 2)).toEqual([0.2, 0.3]);
    expect(resampleLevels([0.1, 0.9, 0.2, 0.4], 2)).toEqual([0.9, 0.4]);
    expect(resampleLevels([], 3)).toEqual([MIN_LEVEL, MIN_LEVEL, MIN_LEVEL]);
  });

  it("derives a stable waveform from an id", () => {
    const levels = seededLevels("upl_a1s2d3f4g5", 24);
    expect(levels).toHaveLength(24);
    expect(seededLevels("upl_a1s2d3f4g5", 24)).toEqual(levels);
    expect(levels.every((level) => level >= MIN_LEVEL && level <= 1)).toBe(true);
  });

  it("formats durations and names recordings", () => {
    expect(formatDuration(30_000)).toBe("0:30");
    expect(formatDuration(125_400)).toBe("2:05");
    expect(voiceFileName("file:///cache/rec.m4a", "voice", new Date(TS))).toBe("voice-2026-09-23T10-00-00-000Z.m4a");
    expect(voiceMimeType("file:///cache/rec.M4A", { m4a: "audio/mp4" }, "audio/x")).toBe("audio/mp4");
    expect(voiceMimeType("file:///cache/rec.ogg", { m4a: "audio/mp4" }, "audio/x")).toBe("audio/x");
  });
});
