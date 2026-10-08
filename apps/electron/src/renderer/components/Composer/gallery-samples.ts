import type { AttachmentChipProps } from "./AttachmentChip";
import { COMPOSER_LABELS } from "./labels";
import type { SlashCommand } from "./model";

export const COMPOSER_GALLERY = {
  hint: "Type / for commands",
  draft: "Summarize the failing tests in tesseract and propose a fix.",
  stop: "Stop",
  width: 311,
  largeWidth: 310,
  groupLabels: {
    followUp: "Follow-up",
    draft: "Draft with attachments",
    locked: "Locked",
    busy: "Busy (stoppable)",
  },
} as const;

export const COMPOSER_SLASH_COMMANDS: readonly SlashCommand[] = [
  { command: "review", description: "Review the uncommitted changes" },
  { command: "test", description: "Run the test suite and fix failures" },
  { command: "explain", description: "Explain this project" },
  { command: "build", description: "Build and report" },
];

export const COMPOSER_ATTACHMENTS: readonly (AttachmentChipProps & { id: string })[] = [
  { id: "a1", name: "crash-report-2026-10-07.log", kind: "file", meta: "48 KB" },
  { id: "a2", name: "design-spec.pdf", kind: "pdf", meta: "1.2 MB", status: "uploading" },
  { id: "a3", name: "voice-note.m4a", kind: "audio", meta: "320 KB", status: "error", error: "Upload failed" },
];

export const COMPOSER_LOCKED_REASON = COMPOSER_LABELS.lockedRunning;

export const GALLERY_PROJECTS = [
  { id: "streaxfit", name: "streaxfit" },
  { id: "tesseract", name: "tesseract" },
  { id: "hybrid-pos", name: "hybrid-pos" },
  { id: "sante-production", name: "sante-production" },
] as const;

export const noop = (): void => undefined;
