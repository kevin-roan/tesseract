import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import { listPids, readProcStat } from "./proc";

const TCP_TABLES = ["/proc/net/tcp", "/proc/net/tcp6"];
const LISTEN_STATE = "0A";
const SOCKET_LINK = /^socket:\[(\d+)\]$/;

export type PortOwner = { pid: number; pgid: number; session: number; command: string };
export type ListeningPortOwner = PortOwner & { port: number };

/** Inode → port of every LISTEN socket in the network namespace (IPv4 and IPv6). */
function listeningSockets(): Map<string, number> {
  const sockets = new Map<string, number>();
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
      const inode = fields[9];
      if (!local || fields[3] !== LISTEN_STATE || !inode || inode === "0") continue;
      sockets.set(inode, Number.parseInt(local.slice(local.lastIndexOf(":") + 1), 16));
    }
  }
  return sockets;
}

function processInfo(pid: number): PortOwner | null {
  const stat = readProcStat(pid);
  return stat ? { pid, pgid: stat.pgrp, session: stat.session, command: stat.command } : null;
}

/**
 * Walks `/proc/<pid>/fd` of every visible process and reports each port whose socket it holds,
 * once per port. `visit` returns true to stop the scan.
 */
function scanOwners(sockets: Map<string, number>, visit: (port: number, owner: PortOwner) => boolean): void {
  if (sockets.size === 0) return;
  const pids = listPids();
  if (!pids) return;
  const seen = new Set<number>();
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
      const inode = SOCKET_LINK.exec(target)?.[1];
      const port = inode === undefined ? undefined : sockets.get(inode);
      if (port === undefined || seen.has(port)) continue;
      const owner = processInfo(pid);
      if (!owner) continue;
      seen.add(port);
      if (visit(port, owner)) return;
    }
  }
}

/** Best-effort lookup of the process listening on a TCP port (Linux /proc; only processes we may inspect). */
export function findPortOwner(port: number): PortOwner | null {
  const sockets = new Map([...listeningSockets()].filter(([, socketPort]) => socketPort === port));
  let found: PortOwner | null = null;
  scanOwners(sockets, (_port, owner) => {
    found = owner;
    return true;
  });
  return found;
}

/** Every TCP port listened on by a process we may inspect, one entry per port, sorted by port. */
export function listListeningPorts(): ListeningPortOwner[] {
  const owners: ListeningPortOwner[] = [];
  scanOwners(listeningSockets(), (port, owner) => {
    owners.push({ port, ...owner });
    return false;
  });
  return owners.sort((a, b) => a.port - b.port);
}
