import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import { listPids, readProcStat } from "./proc";

const TCP_TABLES = ["/proc/net/tcp", "/proc/net/tcp6"];
const LISTEN_STATE = "0A";

export type PortOwner = { pid: number; pgid: number; command: string };

function listeningInodes(port: number): Set<string> {
  const inodes = new Set<string>();
  for (const table of TCP_TABLES) {
    let content: string;
    try {
      content = readFileSync(table, "utf8");
    } catch {
      continue;
    }
    for (const line of content.split("\n").slice(1)) {
      const fields = line.trim().split(/\s+/);
      const local = fields[1];
      if (!local || fields[3] !== LISTEN_STATE) continue;
      const localPort = Number.parseInt(local.slice(local.lastIndexOf(":") + 1), 16);
      const inode = fields[9];
      if (localPort === port && inode && inode !== "0") inodes.add(inode);
    }
  }
  return inodes;
}

function processInfo(pid: number): PortOwner | null {
  const stat = readProcStat(pid);
  return stat ? { pid, pgid: stat.pgrp, command: stat.command } : null;
}

/** Best-effort lookup of the process listening on a TCP port (Linux /proc; only processes we may inspect). */
export function findPortOwner(port: number): PortOwner | null {
  const inodes = listeningInodes(port);
  if (inodes.size === 0) return null;
  const pids = listPids();
  if (!pids) return null;
  for (const pid of pids) {
    let fds: string[];
    try {
      fds = readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue;
    }
    for (const fd of fds) {
      let target: string;
      try {
        target = readlinkSync(`/proc/${pid}/fd/${fd}`);
      } catch {
        continue;
      }
      const match = /^socket:\[(\d+)\]$/.exec(target);
      if (match?.[1] && inodes.has(match[1])) return processInfo(pid);
    }
  }
  return null;
}
