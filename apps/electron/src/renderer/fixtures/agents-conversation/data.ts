import type { AgentRun, AgentRunDetail, AgentRunEvent, Upload } from "@theone/protocol";
import { fixtureAgentRuns, fixtureArchivedRuns, fixtureRunningRun } from "../agents/data";

const LOADED_AT = Date.now();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const at = (offsetMs: number) => new Date(LOADED_AT - offsetMs).toISOString();
const after = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

const usage = (totalTokens: number) => ({
  inputTokens: Math.round(totalTokens * 0.02),
  outputTokens: Math.round(totalTokens * 0.03),
  cacheReadTokens: Math.round(totalTokens * 0.9),
  cacheWriteTokens: totalTokens - Math.round(totalTokens * 0.02) - Math.round(totalTokens * 0.03) - Math.round(totalTokens * 0.9),
  totalTokens,
});

export const CONVERSATION_SESSIONS = {
  architecture: "4b3f9e1c-2a7d-4c55-9f1e-8d2b6a0c7e31",
  failed: "9a8d7c6b-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  cancelled: "e06b331b-7f2e-4d8a-b1c9-3a5e6f7d8c90",
  running: "c4d5e6f7-0a1b-4c2d-9e3f-5a6b7c8d9e0f",
} as const;

const upload = (id: string, name: string, sizeBytes: number, createdAt: string): Upload => ({
  id,
  name,
  mimeType: "image/png",
  kind: "image",
  sizeBytes,
  path: `/workspace/.theone/uploads/${id}/${name}`,
  createdAt,
});

const base = {
  mode: null,
  attachments: [] as Upload[],
  claudeAccountId: "claude-work",
  usage: null,
  result: null,
  error: null,
  archivedAt: null,
} satisfies Partial<AgentRun>;

const doneStart = at(16 * MINUTE);
const previousStart = at(19 * MINUTE);
const failedStart = at(50 * MINUTE);
const cancelledStart = at(7 * HOUR);
const runningStart = at(2 * MINUTE + 14 * SECOND);

export const conversationPreviousRun: AgentRun = {
  ...base,
  id: "run_conv_previous",
  projectId: "monolith",
  prompt: "what if the host machine is mac os, can we still run the android emulator there and keep the same flow?",
  sessionId: CONVERSATION_SESSIONS.architecture,
  state: "succeeded",
  startedAt: previousStart,
  endedAt: after(previousStart, 4 * MINUTE + 12 * SECOND),
  usage: usage(80_400),
  result: "The comparison is above.",
};

export const conversationDoneRun: AgentRun = {
  ...base,
  id: "run_conv_done",
  projectId: "monolith",
  prompt: "yes write this down to artiftecutre",
  sessionId: CONVERSATION_SESSIONS.architecture,
  state: "succeeded",
  startedAt: doneStart,
  endedAt: after(doneStart, 96 * SECOND),
  usage: usage(327_230),
  result: "Nothing is committed.",
};

const failedUpload = upload("upl_conv_failed", "projects-screen.png", 412_000, failedStart);

export const conversationFailedRun: AgentRun = {
  ...base,
  id: "run_conv_failed",
  projectId: "monolith",
  prompt: "in the projects screen the card is not up to the mark, check the screenshot and fix the layout",
  attachments: [failedUpload],
  sessionId: CONVERSATION_SESSIONS.failed,
  state: "failed",
  startedAt: failedStart,
  endedAt: after(failedStart, 117 * SECOND),
  usage: usage(35_028),
  error:
    "API Error: 529 Overloaded. This is a server-side issue, usually temporary — try again in a moment. If it persists, check https://status.claude.com.",
};

const cancelledUpload = upload("upl_conv_cancelled", "notification-sheet.png", 236_000, cancelledStart);

export const conversationCancelledRun: AgentRun = {
  ...base,
  id: "run_conv_cancelled",
  projectId: "monolith",
  prompt: "Take a look at this image.",
  attachments: [cancelledUpload],
  sessionId: CONVERSATION_SESSIONS.cancelled,
  state: "cancelled",
  startedAt: cancelledStart,
  endedAt: after(cancelledStart, 22 * SECOND),
};

export const conversationRunningRun: AgentRun = {
  ...base,
  id: "run_conv_running",
  projectId: "hybrid-pos",
  prompt: "Run the test suite, find the failing tests and fix them.",
  sessionId: CONVERSATION_SESSIONS.running,
  claudeAccountId: "claude",
  state: "running",
  startedAt: runningStart,
  endedAt: null,
};

export const conversationNoSessionRun: AgentRun = {
  ...base,
  id: "run_conv_no_session",
  projectId: null,
  prompt: "Summarise the controller logs from today",
  sessionId: null,
  state: "failed",
  startedAt: at(3 * HOUR),
  endedAt: after(at(3 * HOUR), 4 * SECOND),
  error: "Claude exited before starting a session.",
};

const sessionStarted = (seq: number, ts: string): AgentRunEvent => ({
  kind: "system",
  seq,
  ts,
  text: "Session started (model claude-opus-5-5, cwd /workspace/projects/theone-mobile)",
});

const DONE_TEXT = `Written to \`docs/architecture/host-platforms.md\`. Summary of what it covers:

1. **Linux host (today):** KVM, the host daemon on 7701 and the shared emulator stay exactly as they are.
2. **Windows host:** WHPX replaces KVM. The daemon runs as a per-user service and the emulator binary comes from the same SDK root.
3. **Docker Desktop:** the sandbox talks to the host through \`host.docker.internal\`, so the pairing flow does not change.
4. **iOS:** a separate comparison table. The most important finding: installing an \`.app\` from the sandbox runs native code on the Mac as the user. So iOS support is off by default, and each new \`.app\` needs confirmation on the phone.
5. **Android on a Mac host:** this needs arm64 system images and Homebrew/Android Studio paths. It can only run without isolation, so it's an explicit opt-in with a warning in the app.
6. **Draft types and API:** draft \`/v1/ios/*\` endpoints and types.
7. **Plan:** it starts with a ½–1 day spike on a Mac.

I didn't change \`00-blueprint.md\`, which already has uncommitted edits of yours. Its types should only be added once the code exists. Nothing is committed.`;

const doneEvents: AgentRunEvent[] = [
  sessionStarted(0, doneStart),
  { kind: "tool_use", seq: 1, ts: doneStart, tool: "Read", summary: "/workspace/projects/monolith/docs/architecture/app-runs-and-emulator.md" },
  { kind: "tool_result", seq: 2, ts: doneStart, tool: "Read", isError: false, summary: "Read 412 lines" },
  { kind: "tool_use", seq: 3, ts: doneStart, tool: "Write", summary: "/workspace/projects/monolith/docs/architecture/host-platforms.md" },
  { kind: "tool_result", seq: 4, ts: doneStart, tool: "Write", isError: false, summary: "File created successfully" },
  { kind: "text", seq: 5, ts: doneStart, text: DONE_TEXT },
  { kind: "system", seq: 6, ts: doneStart, text: "Run finished in 92.6 s, 6 turns, 327,230 tokens" },
];

const failedEvents: AgentRunEvent[] = [
  sessionStarted(0, failedStart),
  { kind: "tool_use", seq: 1, ts: failedStart, tool: "Read", summary: failedUpload.path },
  { kind: "tool_result", seq: 2, ts: failedStart, tool: "Read", isError: false, summary: "Read 1 image (412 KB)" },
  {
    kind: "text",
    seq: 3,
    ts: failedStart,
    text: "API Error: 529 Overloaded. This is a server-side issue, usually temporary — try again in a moment. If it persists, check [https://status.claude.com](https://status.claude.com).",
  },
  { kind: "system", seq: 4, ts: failedStart, text: "Run failed (success) in 115.0 s, 3 turns, 35,028 tokens" },
];

const cancelledEvents: AgentRunEvent[] = [
  sessionStarted(0, cancelledStart),
  { kind: "system", seq: 1, ts: cancelledStart, text: "Run cancelled" },
];

export const runningEvents: AgentRunEvent[] = [
  sessionStarted(0, runningStart),
  { kind: "text", seq: 1, ts: runningStart, text: "I'll run the test suite first to see what fails." },
  { kind: "tool_use", seq: 2, ts: runningStart, tool: "Bash", summary: "bun run test" },
  {
    kind: "tool_result",
    seq: 3,
    ts: runningStart,
    tool: "Bash",
    isError: true,
    summary: "2 failed, 148 passed\nFAIL src/cart/totals.test.ts > applies the member discount once",
  },
  { kind: "text", seq: 4, ts: runningStart, text: "Two tests fail in `totals.test.ts`. The member discount is applied twice when a coupon is present." },
  { kind: "tool_use", seq: 5, ts: runningStart, tool: "Read", summary: "/workspace/projects/hybrid-pos/src/cart/totals.ts" },
];

export const CONVERSATION_DETAILS: Readonly<Record<string, AgentRunDetail>> = {
  [conversationPreviousRun.id]: { ...conversationPreviousRun, events: [sessionStarted(0, previousStart)] },
  [conversationDoneRun.id]: { ...conversationDoneRun, events: doneEvents },
  [conversationFailedRun.id]: { ...conversationFailedRun, events: failedEvents },
  [conversationCancelledRun.id]: { ...conversationCancelledRun, events: cancelledEvents },
  [conversationRunningRun.id]: { ...conversationRunningRun, events: runningEvents.slice(0, 2) },
  [conversationNoSessionRun.id]: { ...conversationNoSessionRun, events: [] },
};

export const CONVERSATION_RUNS: readonly AgentRun[] = [
  conversationRunningRun,
  conversationDoneRun,
  conversationPreviousRun,
  conversationFailedRun,
  conversationNoSessionRun,
  conversationCancelledRun,
];

export const CONVERSATION_THUMBNAIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400" viewBox="0 0 320 400"><rect width="320" height="400" rx="18" fill="#101012"/><rect x="16" y="14" width="288" height="18" rx="5" fill="#1e1e20"/><rect x="16" y="56" width="120" height="10" rx="3" fill="#2a2a2d"/><rect x="16" y="80" width="288" height="96" rx="10" fill="#1a1a1b" stroke="#2e2e31"/><rect x="30" y="96" width="90" height="10" rx="3" fill="#e3e3e4"/><rect x="30" y="114" width="160" height="8" rx="3" fill="#6b6b6f"/><rect x="30" y="144" width="60" height="8" rx="3" fill="#4cb782"/><rect x="16" y="196" width="288" height="96" rx="10" fill="#1a1a1b" stroke="#2e2e31"/><rect x="30" y="212" width="110" height="10" rx="3" fill="#e3e3e4"/><rect x="30" y="230" width="140" height="8" rx="3" fill="#6b6b6f"/><circle cx="270" cy="356" r="16" fill="#f5f5f6"/></svg>`;

const LIST_ALIASES: Readonly<Record<string, string>> = {
  run_fx03: conversationDoneRun.id,
  run_fx04: conversationPreviousRun.id,
  run_fx00: conversationRunningRun.id,
};

function listDetail(run: AgentRun): AgentRunDetail {
  const events: AgentRunEvent[] = [sessionStarted(0, run.startedAt)];
  if (run.state !== "running") events.push({ kind: "system", seq: 1, ts: run.startedAt, text: "Run finished" });
  return { ...run, events };
}

export function conversationDetail(id: string): AgentRunDetail | null {
  const own = CONVERSATION_DETAILS[id];
  if (own) return own;
  const listed = [fixtureRunningRun, ...fixtureAgentRuns, ...fixtureArchivedRuns].find((run) => run.id === id);
  if (!listed) return null;
  const alias = LIST_ALIASES[id];
  const detail = alias ? CONVERSATION_DETAILS[alias] : undefined;
  if (!detail) return listDetail(listed);
  return {
    ...detail,
    id: listed.id,
    prompt: listed.prompt,
    projectId: listed.projectId,
    sessionId: listed.sessionId,
    archivedAt: listed.archivedAt,
    startedAt: listed.startedAt,
    endedAt: detail.endedAt ? new Date(Date.parse(listed.startedAt) + Date.parse(detail.endedAt) - Date.parse(detail.startedAt)).toISOString() : null,
  };
}
