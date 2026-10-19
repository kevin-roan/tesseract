import type { RuntimeEntry, RuntimeKind } from "@tesseract/protocol";

const MB = 1024 * 1024;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function seed(): RuntimeEntry[] {
  return [
    { kind: "process", id: "proc-dev", name: "dev", detail: "bun run dev", pid: 2311, projectId: "web", startedAt: minutesAgo(42), state: "running", cpuPercent: 3.2, memoryBytes: 182 * MB, supervised: false, canStop: true },
    { kind: "app-run", id: "run-android", name: "Android app", detail: "expo run:android", pid: 2788, projectId: "mobile", startedAt: minutesAgo(12), state: "running", cpuPercent: 18.4, memoryBytes: 640 * MB, supervised: false, canStop: true },
    { kind: "agent-run", id: "agent-1", name: "Fix the login form", detail: "claude", pid: 3120, projectId: "web", startedAt: minutesAgo(5), state: "running", cpuPercent: 1.1, memoryBytes: 96 * MB, supervised: false, canStop: true },
    { kind: "terminal", id: "term-1", name: "Shell", detail: "bash", pid: 3301, projectId: null, startedAt: minutesAgo(90), state: "running", cpuPercent: 0, memoryBytes: 4 * MB, supervised: false, canStop: true },
    { kind: "browser", id: "chromium", name: "Chromium", detail: "chromium --remote-debugging-port=9222", pid: 512, projectId: null, startedAt: minutesAgo(300), state: "running", cpuPercent: 7.6, memoryBytes: 812 * MB, supervised: true, canStop: true },
    { kind: "vnc", id: "display", name: "Display :1", detail: "Xvnc + noVNC", pid: 120, projectId: null, startedAt: minutesAgo(300), state: "running", cpuPercent: 0.4, memoryBytes: 48 * MB, supervised: true, canStop: true },
  ];
}

let entries = seed();

export function fixtureRuntime() {
  return { entries };
}

export function stopFixtureRuntime(kind: string, id: string): RuntimeEntry | null {
  const entry = entries.find((item) => item.kind === (kind as RuntimeKind) && item.id === id);
  if (!entry) return null;
  entries = entries.filter((item) => item !== entry);
  return { ...entry, state: "stopped" };
}

export function resetFixtureRuntime(): void {
  entries = seed();
}
