import type { AgentRun, ClaudeSession, InboxItem } from "@tesseract/protocol";
import { sampleAgentRun, sampleClaudeSession, sampleInboxItem } from "@tesseract/protocol/fixtures";

const MINUTE_MS = 60_000;
const loadedAt = Date.now();

export const minutesAgo = (minutes: number): string => new Date(loadedAt - minutes * MINUTE_MS).toISOString();

const usage = (totalTokens: number): AgentRun["usage"] => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: totalTokens,
  cacheWriteTokens: 0,
  totalTokens,
});

interface RunSeed {
  id: string;
  prompt: string;
  projectId: string | null;
  tokens: number | null;
  startedAt: string;
  session: string;
  state?: AgentRun["state"];
  archived?: boolean;
  error?: string | null;
}

const run = ({ id, prompt, projectId, tokens, startedAt, session, state = "succeeded", archived = false, error = null }: RunSeed): AgentRun => ({
  ...sampleAgentRun,
  id,
  prompt,
  projectId,
  attachments: [],
  sessionId: session,
  state,
  startedAt,
  endedAt: state === "running" ? null : startedAt,
  usage: tokens === null ? null : usage(tokens),
  result: null,
  error,
  archivedAt: archived ? startedAt : null,
});

const SESSION = {
  emulator: "0b5e4c1a-1111-4a8e-9a1b-000000000001",
  commands: "0b5e4c1a-1111-4a8e-9a1b-000000000002",
  architecture: "0b5e4c1a-1111-4a8e-9a1b-000000000003",
  mobile: "0b5e4c1a-1111-4a8e-9a1b-000000000004",
  workspace: "0b5e4c1a-1111-4a8e-9a1b-000000000005",
  sales: "0b5e4c1a-1111-4a8e-9a1b-000000000006",
  card: "0b5e4c1a-1111-4a8e-9a1b-000000000007",
  usage: "0b5e4c1a-1111-4a8e-9a1b-000000000008",
  running: "0b5e4c1a-1111-4a8e-9a1b-000000000009",
} as const;

export const fixtureAgentRuns: AgentRun[] = [
  run({ id: "run_fx01", prompt: "run that app again on the emulator, and check the login flow", projectId: "streaxfit", tokens: 396_000, startedAt: minutesAgo(11), session: SESSION.emulator }),
  run({ id: "run_fx02", prompt: "we need commands like these /setup /pair for the controller", projectId: "tesseract", tokens: 1_600_000, startedAt: minutesAgo(14), session: SESSION.commands }),
  run({ id: "run_fx03", prompt: "yes write this down to artiftecutre", projectId: "tesseract", tokens: 327_000, startedAt: minutesAgo(15), session: SESSION.architecture }),
  run({ id: "run_fx04", prompt: "what if the host machine is mac os, how does the emulator run?", projectId: "tesseract", tokens: 80_400, startedAt: minutesAgo(17), session: SESSION.architecture }),
  run({ id: "run_fx05", prompt: "expo-android (Android emulator) fails to boot after the update", projectId: "streaxfit", tokens: 1_200_000, startedAt: minutesAgo(19), session: SESSION.emulator }),
  run({ id: "run_fx06", prompt: "On the mobile application, the push notifications arrive twice", projectId: "tesseract", tokens: 4_200_000, startedAt: minutesAgo(43), session: SESSION.mobile }),
  run({ id: "run_fx07", prompt: "attach that file to workspace files and share it", projectId: "hybrid-pos", tokens: 251_000, startedAt: minutesAgo(46), session: SESSION.workspace }),
  run({ id: "run_fx08", prompt: "Tell me how the shift manager on the POS closes a till", projectId: "hybrid-pos", tokens: 682_000, startedAt: minutesAgo(49), session: SESSION.workspace }),
  run({ id: "run_fx09", prompt: "Currently, our application has sales reports that are slow", projectId: "hybrid-pos", tokens: 2_300_000, startedAt: minutesAgo(52), session: SESSION.sales }),
  run({ id: "run_fx10", prompt: "remove this , replace that with something cleaner", projectId: "tesseract", tokens: 1_300_000, startedAt: minutesAgo(64), session: SESSION.card }),
  run({ id: "run_fx11", prompt: "Still the card it is not up to the mark, make it match Linear", projectId: "tesseract", tokens: 1_100_000, startedAt: minutesAgo(250), session: SESSION.card }),
  run({ id: "run_fx12", prompt: "## Redesign the project card\n- tighter spacing", projectId: "tesseract", tokens: 912_000, startedAt: minutesAgo(400), session: SESSION.card }),
  run({ id: "run_fx13", prompt: "Summarise the logs", projectId: null, tokens: 12_300, startedAt: minutesAgo(1600), session: SESSION.usage }),
];

const archivedAt = (date: string) => `${date}T10:00:00.000Z`;

export const fixtureArchivedRuns: AgentRun[] = [
  run({ id: "run_ar01", prompt: "hi", projectId: "tesseract", tokens: 0, startedAt: minutesAgo(1500), session: SESSION.usage, state: "failed", archived: true, error: "Claude exited with code 1" }),
  run({ id: "run_ar02", prompt: "try this again", projectId: "tesseract", tokens: 0, startedAt: minutesAgo(1520), session: SESSION.mobile, state: "failed", archived: true, error: "Claude exited with code 1" }),
  run({ id: "run_ar03", prompt: "hi", projectId: null, tokens: 143_000, startedAt: archivedAt("2026-09-28"), session: SESSION.usage, archived: true }),
  run({ id: "run_ar04", prompt: "/usage", projectId: null, tokens: 0, startedAt: "2026-09-28T09:50:00.000Z", session: SESSION.usage, archived: true }),
  run({ id: "run_ar05", prompt: "vyvuv", projectId: null, tokens: 142_000, startedAt: "2026-09-28T09:40:00.000Z", session: SESSION.usage, archived: true }),
  run({ id: "run_ar06", prompt: "where is it running ?", projectId: null, tokens: 284_000, startedAt: "2026-09-28T09:30:00.000Z", session: SESSION.usage, archived: true }),
  run({ id: "run_ar07", prompt: "where is it running ?", projectId: null, tokens: 284_000, startedAt: "2026-09-28T09:20:00.000Z", session: SESSION.usage, archived: true }),
  run({ id: "run_ar08", prompt: "where is it running ?", projectId: null, tokens: 284_000, startedAt: "2026-09-28T09:10:00.000Z", session: SESSION.usage, archived: true }),
  run({ id: "run_ar09", prompt: "where is it running ?", projectId: null, tokens: 284_000, startedAt: "2026-09-28T09:00:00.000Z", session: SESSION.usage, archived: true }),
  run({ id: "run_ar10", prompt: "where is it running ?", projectId: null, tokens: 284_000, startedAt: "2026-09-28T08:50:00.000Z", session: SESSION.usage, archived: true }),
];

export const fixtureRunningRun: AgentRun = run({
  id: "run_fx00",
  prompt: "Fix the failing sync tests in the controller",
  projectId: "tesseract",
  tokens: null,
  startedAt: minutesAgo(2),
  session: SESSION.running,
  state: "running",
});

export const fixtureAttentionItems: InboxItem[] = [
  {
    ...sampleInboxItem,
    id: "inb_fxattn1",
    kind: "needs_input",
    title: "Claude needs your input",
    body: "Which emulator image should I use for the login test?",
    projectId: "streaxfit",
    sessionId: SESSION.emulator,
    agentRunId: "run_fx01",
    terminalId: null,
    artifactId: null,
    createdAt: minutesAgo(3),
    updatedAt: minutesAgo(3),
    readAt: null,
  },
  {
    ...sampleInboxItem,
    id: "inb_fxfile1",
    kind: "file",
    title: "streaxfit-release.apk",
    body: "Shared from the sandbox",
    projectId: "streaxfit",
    sessionId: null,
    agentRunId: null,
    terminalId: null,
    artifactId: "art_fxapk01",
    createdAt: minutesAgo(6),
    updatedAt: minutesAgo(6),
    readAt: null,
  },
];

export const fixtureTerminalSession: ClaudeSession = {
  ...sampleClaudeSession,
  sessionId: "0b5e4c1a-2222-4a8e-9a1b-000000000001",
  projectId: "hybrid-pos",
  title: "Refactor the receipt printer driver",
  source: "terminal",
  agentRunId: null,
  terminalId: "trm_fxclaude1",
  active: true,
  lastActiveAt: minutesAgo(1),
};
