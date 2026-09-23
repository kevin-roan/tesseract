import { listPids, readProcStat, type ProcStat } from "./proc";

const POLL_MS = 50;
const KILL_WAIT_MS = 2_000;
const DEFUNCT_STATES = new Set(["Z", "X"]);
const LISTED_LEFTOVERS = 5;

export type Leftover = Pick<ProcStat, "pid" | "command">;

/** Every child is spawned detached (setsid), so its pid is also its process-group and session id. */
export function signalGroup(pgid: number, signal: NodeJS.Signals | number): boolean {
  try {
    process.kill(-pgid, signal);
    return true;
  } catch {
    return false;
  }
}

export function groupAlive(pgid: number): boolean {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Live processes in the leader's process group or session (job-control shells move
 * background jobs into their own groups). Neither id can be recycled while a member
 * exists, so everything found really descends from the leader. Null without procfs.
 */
export function groupMembers(leader: number): ProcStat[] | null {
  const pids = listPids();
  if (!pids) return null;
  const members: ProcStat[] = [];
  for (const pid of pids) {
    const stat = readProcStat(pid);
    if (stat && !DEFUNCT_STATES.has(stat.state) && (stat.pgrp === leader || stat.session === leader)) members.push(stat);
  }
  return members;
}

function membersRemain(leader: number): boolean {
  const members = groupMembers(leader);
  return members ? members.length > 0 : groupAlive(leader);
}

function signalMembers(leader: number, signal: NodeJS.Signals): void {
  signalGroup(leader, signal);
  const groups = new Set((groupMembers(leader) ?? []).map((member) => member.pgrp));
  groups.delete(leader);
  for (const pgid of groups) signalGroup(pgid, signal);
}

async function settles(done: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (done()) return true;
    await Bun.sleep(POLL_MS);
  }
  return done();
}

/**
 * Sends `signal` to the whole group (and the other groups of its session), waits up to
 * `graceMs` for the leader and every other member to go away, then SIGKILLs whatever is left.
 */
export async function terminateGroup(
  pgid: number,
  exited: Promise<unknown>,
  graceMs: number,
  signal: NodeJS.Signals = "SIGTERM",
): Promise<void> {
  let leaderExited = false;
  void exited.then(() => {
    leaderExited = true;
  });
  const gone = () => leaderExited && !membersRemain(pgid);
  signalMembers(pgid, signal);
  if (await settles(gone, graceMs)) return;
  signalMembers(pgid, "SIGKILL");
  await settles(gone, KILL_WAIT_MS);
}

/** Processes still running in an exited leader's group or session ("cmd &", dev servers, daemons). */
export function groupLeftovers(leader: number): Leftover[] {
  const members = groupMembers(leader);
  if (members) return members.map(({ pid, command }) => ({ pid, command }));
  return groupAlive(leader) ? [{ pid: leader, command: "process group" }] : [];
}

export function describeLeftovers(leftovers: Leftover[]): string {
  const listed = leftovers
    .slice(0, LISTED_LEFTOVERS)
    .map((leftover) => `${leftover.command} (${leftover.pid})`)
    .join(", ");
  const more = leftovers.length > LISTED_LEFTOVERS ? ` and ${leftovers.length - LISTED_LEFTOVERS} more` : "";
  const noun = leftovers.length === 1 ? "process" : "processes";
  return `Stopping ${leftovers.length} ${noun} left running in the process group: ${listed}${more}`;
}

/**
 * Called once the leader has exited: SIGTERMs what it left behind, SIGKILL after `graceMs`,
 * so nothing outlives the tracked row. `onLeftovers` runs before any signal is sent.
 */
export async function reapGroup(leader: number, graceMs: number, onLeftovers: (leftovers: Leftover[]) => void): Promise<void> {
  const leftovers = groupLeftovers(leader);
  if (leftovers.length === 0) return;
  onLeftovers(leftovers);
  await terminateGroup(leader, Promise.resolve(), graceMs);
}
