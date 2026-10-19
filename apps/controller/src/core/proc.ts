import { readdirSync, readFileSync, readlinkSync } from "node:fs";

export type ProcStat = { pid: number; command: string; state: string; ppid: number; pgrp: number; session: number };

const PROC_ROOT = "/proc";
const PID_NAME = /^\d+$/;

export function readProcStat(pid: number): ProcStat | null {
  let stat: string;
  try {
    stat = readFileSync(`${PROC_ROOT}/${pid}/stat`, "utf8");
  } catch {
    return null;
  }
  const close = stat.lastIndexOf(")");
  const [state = "", ppid, pgrp, session] = stat.slice(close + 2).split(" ");
  return { pid, command: stat.slice(stat.indexOf("(") + 1, close), state, ppid: Number(ppid), pgrp: Number(pgrp), session: Number(session) };
}

/** Every pid visible under /proc, or null where there is no procfs. */
export function listPids(): number[] | null {
  try {
    return readdirSync(PROC_ROOT)
      .filter((name) => PID_NAME.test(name))
      .map(Number);
  } catch {
    return null;
  }
}

/** `roots` and every live process descending from them. */
export function processTree(roots: number[]): number[] {
  const children = new Map<number, number[]>();
  for (const pid of listPids() ?? []) {
    const stat = readProcStat(pid);
    if (!stat || stat.state === "Z" || stat.state === "X") continue;
    children.set(stat.ppid, [...(children.get(stat.ppid) ?? []), pid]);
  }
  const tree = new Set<number>();
  const pending = [...roots];
  while (pending.length > 0) {
    const pid = pending.pop()!;
    if (tree.has(pid)) continue;
    tree.add(pid);
    pending.push(...(children.get(pid) ?? []));
  }
  return [...tree];
}

/** The working directory of a process we may inspect. */
export function readProcCwd(pid: number): string | null {
  try {
    return readlinkSync(`${PROC_ROOT}/${pid}/cwd`);
  } catch {
    return null;
  }
}

/** `ProcStat` plus CPU ticks (user + system), start time (ticks after boot) and resident memory (pages). */
export type ProcSample = ProcStat & { cpuTicks: number; startTicks: number; rssPages: number };

export const CLOCK_TICKS_PER_SECOND = 100;
export const PAGE_BYTES = 4096;

export function readProcSample(pid: number): ProcSample | null {
  let stat: string;
  try {
    stat = readFileSync(`${PROC_ROOT}/${pid}/stat`, "utf8");
  } catch {
    return null;
  }
  const close = stat.lastIndexOf(")");
  const fields = stat.slice(close + 2).split(" ");
  const field = (index: number) => Number(fields[index] ?? 0) || 0;
  return {
    pid,
    command: stat.slice(stat.indexOf("(") + 1, close),
    state: fields[0] ?? "",
    ppid: field(1),
    pgrp: field(2),
    session: field(3),
    cpuTicks: field(11) + field(12),
    startTicks: field(19),
    rssPages: field(21),
  };
}

/** argv of a process (empty for kernel threads), or null when it is gone or hidden. */
export function readProcCmdline(pid: number): string[] | null {
  try {
    return readFileSync(`${PROC_ROOT}/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

/** Seconds since boot, or null without procfs. */
export function readUptimeSeconds(): number | null {
  try {
    const seconds = Number(readFileSync(`${PROC_ROOT}/uptime`, "utf8").split(" ")[0]);
    return Number.isFinite(seconds) ? seconds : null;
  } catch {
    return null;
  }
}
