import type { BuildJob, LogLine, ProcessInfo } from "@theone/protocol";

import { cleanLogText } from "@/components/log-view/lines";

import { buildProfileLabel, buildTargetLabel } from "./labels";
import { commandLabel } from "./projects";

/** The tail of the log that goes into the prompt; the error is almost always at the end. */
export const FIX_LOG_TAIL = 150;

export type FailureContext = {
  /** What failed, e.g. `Script "package:win"` or `Windows release build`. */
  subject: string;
  command?: string | null;
  exitCode?: number | null;
  error?: string | null;
  lines: readonly Pick<LogLine, "text">[];
};

export function canFixProcess(process: ProcessInfo): boolean {
  return process.state === "failed";
}

export function canFixBuild(build: BuildJob): boolean {
  return build.state === "failed";
}

export function processFailure(process: ProcessInfo, lines: readonly LogLine[]): FailureContext {
  return {
    subject: `\`${process.name}\``,
    command: commandLabel(process.command),
    exitCode: process.exitCode,
    lines,
  };
}

export function buildFailure(build: BuildJob, lines: readonly LogLine[]): FailureContext {
  return {
    subject: `The ${buildTargetLabel(build.target)} ${buildProfileLabel(build.profile).toLowerCase()} build`,
    error: build.error,
    lines,
  };
}

/** A ready-to-send chat prompt asking the agent to find and fix the cause of a failure. */
export function failurePrompt({ subject, command, exitCode, error, lines }: FailureContext): string {
  const log = lines
    .slice(-FIX_LOG_TAIL)
    .map((line) => cleanLogText(line.text))
    .join("\n")
    .trim();
  const facts = [
    command ? `Command: \`${command}\`` : null,
    exitCode !== null && exitCode !== undefined ? `Exit code: ${exitCode}` : null,
    error ? `Error: ${error}` : null,
  ].filter((fact): fact is string => fact !== null);

  return [
    `${subject} failed. Find the cause and fix it, then run it again to confirm it works.`,
    facts.join("\n"),
    log ? `Last ${Math.min(lines.length, FIX_LOG_TAIL)} log lines:\n\`\`\`\n${log}\n\`\`\`` : "No log output was captured.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
