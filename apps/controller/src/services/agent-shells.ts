import { processTree, readProcCmdline, readProcStat, readProcStdout } from "../core/proc";

export type DiscoveredShell = { id: string; pid: number; command: string; logPath: string };

export type ShellLog = { text: string; truncated: boolean };

const TASK_OUTPUT = /\/tasks\/([\w.-]+)\.output$/;
const WRAPPED_COMMAND = /\beval '([\s\S]*)'\s+(?:<|\||&&)/;
const SHELL_QUOTE = /'(?:"'"|\\')'/g;
const MAX_LOG_BYTES = 128 * 1024;

/** The command Claude asked for, unwrapped from the `<shell> -c "… eval '<command>' < /dev/null …"` it runs. */
export function shellCommand(argv: readonly string[], fallback: string): string {
  const script = argv.at(-1) ?? "";
  const wrapped = WRAPPED_COMMAND.exec(script)?.[1];
  if (wrapped) return wrapped.replace(SHELL_QUOTE, "'").trim();
  return argv.join(" ").trim() || fallback;
}

/**
 * Claude Code starts every Bash tool call in its own session, with stdout redirected to
 * `…/tasks/<id>.output`, so shells are found by walking the process tree rather than the group.
 * Processes a shell spawned inherit its stdout; only the outermost one is reported.
 */
export function discoverShells(leader: number): DiscoveredShell[] {
  const logs = new Map<number, string>();
  for (const pid of processTree([leader])) {
    if (pid === leader) continue;
    const target = readProcStdout(pid);
    if (target && TASK_OUTPUT.test(target)) logs.set(pid, target);
  }
  const shells: DiscoveredShell[] = [];
  for (const [pid, logPath] of logs) {
    const stat = readProcStat(pid);
    if (!stat || logs.get(stat.ppid) === logPath) continue;
    const id = TASK_OUTPUT.exec(logPath)?.[1];
    if (id) shells.push({ id, pid, logPath, command: shellCommand(readProcCmdline(pid) ?? [], stat.command) });
  }
  return shells;
}

/** The end of a shell's output file; a cut-off first line is dropped. A missing file reads as empty. */
export async function readShellLog(path: string, maxBytes: number = MAX_LOG_BYTES): Promise<ShellLog> {
  const file = Bun.file(path);
  if (!(await file.exists())) return { text: "", truncated: false };
  const start = Math.max(0, file.size - maxBytes);
  const text = await file.slice(start).text();
  if (start === 0) return { text, truncated: false };
  return { text: text.slice(text.indexOf("\n") + 1), truncated: true };
}
