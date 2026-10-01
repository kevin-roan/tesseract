import { readdirSync, readFileSync, readlinkSync } from "node:fs";

export type ProcStat = { pid: number; command: string; state: string; pgrp: number; session: number };

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
  const [state = "", , pgrp, session] = stat.slice(close + 2).split(" ");
  return { pid, command: stat.slice(stat.indexOf("(") + 1, close), state, pgrp: Number(pgrp), session: Number(session) };
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

/** The working directory of a process we may inspect. */
export function readProcCwd(pid: number): string | null {
  try {
    return readlinkSync(`${PROC_ROOT}/${pid}/cwd`);
  } catch {
    return null;
  }
}
