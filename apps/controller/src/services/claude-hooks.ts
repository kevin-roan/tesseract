import { isIdOfKind, type ClaudeHookPayload, type InboxItem, type InboxKind } from "@tesseract/protocol";
import { realpathOrNull } from "../core/paths";
import type { Logger } from "../core/logger";
import type { Config } from "../config";
import type { AgentRunService } from "./agent-runs";
import { snippet, type InboxService } from "./inbox";
import { projectForCwd } from "./ports";
import type { TerminalService } from "./terminals";

/** Added to the hook JSON by `tesseract-controller hook` from the environment Claude Code runs in. */
export const HOOK_TERMINAL_FIELD = "tesseract_terminal_id";
export const HOOK_AGENT_RUN_FIELD = "tesseract_agent_run_id";

const TRANSCRIPT_TAIL_BYTES = 64 * 1024;

type NotificationAction = { kind: InboxKind; title: string } | "answered" | null;

const NEEDS_INPUT = { kind: "needs_input", title: "Claude is waiting for input" } as const;
const PERMISSION = { kind: "permission", title: "Claude needs permission" } as const;

const NOTIFICATION_TYPES: Record<string, NotificationAction> = {
  permission_prompt: PERMISSION,
  idle_prompt: NEEDS_INPUT,
  agent_needs_input: NEEDS_INPUT,
  elicitation_dialog: NEEDS_INPUT,
  elicitation_url_dialog: NEEDS_INPUT,
  elicitation_complete: "answered",
  elicitation_response: "answered",
  auth_success: null,
  agent_completed: null,
};

export function notificationAction(type: string | undefined, message: string | undefined): NotificationAction {
  if (type !== undefined && Object.hasOwn(NOTIFICATION_TYPES, type)) return NOTIFICATION_TYPES[type] ?? null;
  if (type?.startsWith("quota_")) return { kind: "status", title: "Claude usage quota" };
  return /permission/i.test(message ?? "") ? PERMISSION : NEEDS_INPUT;
}

const stringField = (payload: ClaudeHookPayload, key: string): string | null => {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
};

/** The text of the last assistant message in the tail of a Claude Code transcript (JSONL). */
export async function lastAssistantText(path: string, tailBytes = TRANSCRIPT_TAIL_BYTES): Promise<string | null> {
  if (!path.endsWith(".jsonl")) return null;
  let text: string;
  try {
    const file = Bun.file(path);
    text = await file.slice(Math.max(0, file.size - tailBytes)).text();
  } catch {
    return null;
  }
  const lines = text.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (!line) continue;
    try {
      const entry = JSON.parse(line) as { type?: unknown; message?: { content?: unknown } };
      if (entry.type !== "assistant" || !Array.isArray(entry.message?.content)) continue;
      const parts = (entry.message.content as Array<{ type?: unknown; text?: unknown }>)
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text as string);
      if (parts.join("").trim()) return parts.join("\n");
    } catch {}
  }
  return null;
}

/** Turns Claude Code hook calls (`POST /v1/hooks/claude`) into inbox items. */
export class ClaudeHookService {
  constructor(
    private readonly config: Config,
    private readonly inbox: InboxService,
    private readonly agentRuns: AgentRunService,
    private readonly terminals: TerminalService,
    private readonly logger: Logger,
  ) {}

  async ingest(payload: ClaudeHookPayload): Promise<InboxItem | null> {
    const sessionId = payload.session_id?.trim() || null;
    const link = { sessionId, agentRunId: this.agentRunFor(payload, sessionId) };
    const context = { ...link, projectId: this.projectFor(payload.cwd), terminalId: this.terminalFor(payload) };
    this.logger.debug("claude hook", { event: payload.hook_event_name, session: sessionId ?? undefined });

    switch (payload.hook_event_name) {
      case "Notification": {
        const action = notificationAction(payload.notification_type, payload.message);
        if (action === null) return null;
        if (action === "answered") {
          this.inbox.clearAttention(link);
          return null;
        }
        return this.inbox.add({ ...context, ...action, body: snippet(payload.message ?? "") || action.title });
      }
      case "Stop": {
        this.inbox.clearAttention(link);
        return this.inbox.add({ ...context, kind: "completed", title: "Claude finished", body: await this.stopBody(payload, context.projectId) });
      }
      case "StopFailure": {
        this.inbox.clearAttention(link);
        const reason = stringField(payload, "error_type") ?? "unknown";
        return this.inbox.add({ ...context, kind: "failed", title: "Claude stopped with an error", body: snippet(`${reason}${payload.message ? `: ${payload.message}` : ""}`) });
      }
      case "UserPromptSubmit":
        this.inbox.clearAttention(link);
        return null;
      default:
        return null;
    }
  }

  private async stopBody(payload: ClaudeHookPayload, projectId: string | null): Promise<string> {
    const last =
      stringField(payload, "last_assistant_message") ?? (payload.transcript_path ? await lastAssistantText(payload.transcript_path) : null);
    return snippet(last ?? "") || projectId || payload.cwd || "";
  }

  private projectFor(cwd: string | undefined): string | null {
    if (!cwd) return null;
    const projectsDir = realpathOrNull(this.config.projectsDir) ?? this.config.projectsDir;
    return projectForCwd(projectsDir, realpathOrNull(cwd) ?? cwd);
  }

  private agentRunFor(payload: ClaudeHookPayload, sessionId: string | null): string | null {
    const fromEnv = stringField(payload, HOOK_AGENT_RUN_FIELD);
    const running = this.agentRuns.running();
    const bySession = sessionId === null ? undefined : running.find((run) => run.sessionId === sessionId);
    if (bySession) return bySession.id;
    if (!fromEnv || !isIdOfKind("agentRun", fromEnv)) return null;
    return running.some((run) => run.id === fromEnv && (run.sessionId === null || sessionId === null)) ? fromEnv : null;
  }

  private terminalFor(payload: ClaudeHookPayload): string | null {
    const id = stringField(payload, HOOK_TERMINAL_FIELD);
    return id && isIdOfKind("terminal", id) && this.terminals.has(id) ? id : null;
  }
}
