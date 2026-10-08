import type { CreateTerminal, TerminalInfo } from "@tesseract/protocol";
import { currentScenario } from "../scenario";

export const TERMINAL_SCENARIOS = {
  empty: "empty",
  loading: "loading",
  exited: "exited",
} as const;

export const FIXTURE_SHELL_ID = "trm_fixture_shell";
export const FIXTURE_CLAUDE_ID = "trm_fixture_claude";

const HOUR_MS = 3_600_000;
const SLACK_MS = 300_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const terminal = (overrides: Partial<TerminalInfo> & Pick<TerminalInfo, "id">): TerminalInfo => ({
  kind: "shell",
  projectId: null,
  title: "bash",
  cwd: "/workspace",
  pid: 4242,
  cols: 49,
  rows: 18,
  state: "running",
  exitCode: null,
  createdAt: ago(4 * HOUR_MS + SLACK_MS),
  ...overrides,
});

function initialTerminals(): TerminalInfo[] {
  if (currentScenario() === TERMINAL_SCENARIOS.empty) return [];
  return [
    terminal({ id: FIXTURE_SHELL_ID }),
    terminal({
      id: FIXTURE_CLAUDE_ID,
      kind: "claude",
      projectId: "streaxfit",
      title: "claude",
      cwd: "/workspace/streaxfit",
      pid: 4343,
      rows: 32,
      createdAt: ago(7 * HOUR_MS + SLACK_MS),
    }),
  ];
}

let terminals: TerminalInfo[] | null = null;
let sequence = 0;

export function fixtureTerminals(): TerminalInfo[] {
  terminals ??= initialTerminals();
  return terminals;
}

export function createFixtureTerminal(body: Partial<CreateTerminal> | undefined): TerminalInfo {
  sequence += 1;
  const info = terminal({
    id: `trm_fixture_new_${sequence}`,
    kind: body?.kind ?? "shell",
    projectId: body?.projectId ?? null,
    cols: body?.cols ?? 100,
    rows: body?.rows ?? 30,
    createdAt: new Date().toISOString(),
  });
  terminals = [info, ...fixtureTerminals()];
  return info;
}

export function closeFixtureTerminal(id: string): TerminalInfo | null {
  const info = fixtureTerminals().find((candidate) => candidate.id === id);
  if (!info) return null;
  terminals = fixtureTerminals().filter((candidate) => candidate.id !== id);
  return { ...info, state: "exited", exitCode: 0 };
}

const ESC = "\x1b";
const BOX_WIDTH = 41;
const prompt = (cwd: string) => `${ESC}[1;32mdev@tesseract-sandbox${ESC}[0m:${ESC}[1;34m${cwd}${ESC}[0m$ `;

export function fixtureScreen(id: string): string {
  if (id === FIXTURE_CLAUDE_ID) {
    const border = (text: string) => `${ESC}[38;5;174m${text}${ESC}[0m`;
    const line = (plain: string, styled: string) => `${border("│")} ${styled}${" ".repeat(Math.max(0, BOX_WIDTH - 2 - plain.length))} ${border("│")}`;
    return [
      border(`╭${"─".repeat(BOX_WIDTH)}╮`),
      line("* Welcome to Claude Code!", `${ESC}[38;5;174m*${ESC}[0m ${ESC}[1mWelcome to Claude Code!${ESC}[0m`),
      line("", ""),
      line("  cwd: /workspace/streaxfit", `  ${ESC}[2mcwd: /workspace/streaxfit${ESC}[0m`),
      border(`╰${"─".repeat(BOX_WIDTH)}╯`),
      "",
      `${ESC}[2m>${ESC}[0m Try "fix the failing tests in src/api"`,
      "",
    ].join("\r\n");
  }
  return [
    `${prompt("/workspace")}ls`,
    `${ESC}[1;34mhybrid-pos${ESC}[0m  ${ESC}[1;34mtesseract${ESC}[0m  ${ESC}[1;34msante-production${ESC}[0m  ${ESC}[1;34mstreaxfit${ESC}[0m  README.md`,
    `${prompt("/workspace")}git -C tesseract status --short`,
    ` ${ESC}[31mM${ESC}[0m apps/electron/src/renderer/pages/terminals/TerminalsPage.tsx`,
    `${ESC}[32m??${ESC}[0m docs/electron/terminals.md`,
    `${prompt("/workspace")}echo "docs: https://docs.expo.dev"`,
    "docs: https://docs.expo.dev",
    prompt("/workspace"),
  ].join("\r\n");
}

export const FIXTURE_EXIT_CODE = 1;

export function resetFixtureTerminals(): void {
  terminals = null;
  sequence = 0;
}
