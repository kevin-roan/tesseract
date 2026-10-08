import type { ClaudeSession, Project } from "@tesseract/protocol";

import { projectLabel, projectNames, sessionTitle } from "@/features/chats/utils/sessions";
import { formatRelativeTime } from "@/features/sandbox/utils/format";
import { frameworkLabel } from "@/features/sandbox/utils/labels";

import type { AttachDestination } from "../types";

export const NEW_CHAT_DESTINATION: AttachDestination = {
  kind: "new-chat",
  id: "new-chat",
  label: "New chat",
  detail: "Start from the Home composer",
};

export function attachDestinations(
  projects: readonly Project[] = [],
  sessions: readonly ClaudeSession[] = [],
  now: number = Date.now(),
): { projects: AttachDestination[]; chats: AttachDestination[] } {
  const names = projectNames(projects);
  return {
    projects: projects.map((project) => ({
      kind: "project",
      id: project.id,
      label: project.name,
      detail: frameworkLabel(project.framework),
    })),
    chats: sessions.map((session) => ({
      kind: "chat",
      id: session.sessionId,
      label: sessionTitle(session),
      detail: [projectLabel(session.projectId, names), formatRelativeTime(session.lastActiveAt, now)].filter(Boolean).join(" · "),
    })),
  };
}
