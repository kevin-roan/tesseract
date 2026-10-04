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
