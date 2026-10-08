import type { ClaudeSession, Project } from "@tesseract/protocol";

export type SessionTarget =
  | { kind: "agentRun"; id: string }
  | { kind: "terminal"; id: string }
  | { kind: "resume"; id: string };

export function sessionTarget(session: Pick<ClaudeSession, "sessionId" | "agentRunId" | "terminalId">): SessionTarget {
  if (session.agentRunId) return { kind: "agentRun", id: session.agentRunId };
  if (session.terminalId) return { kind: "terminal", id: session.terminalId };
  return { kind: "resume", id: session.sessionId };
}

export function sessionTitle(session: Pick<ClaudeSession, "title">): string {
  return session.title?.trim() || "Untitled chat";
}

export function projectNames(projects: readonly Project[] | undefined): Map<string, string> {
  return new Map((projects ?? []).map((project) => [project.id, project.name]));
}

export function projectLabel(projectId: string | null, names: ReadonlyMap<string, string>): string | null {
  if (!projectId) return null;
  return names.get(projectId) ?? projectId;
}
