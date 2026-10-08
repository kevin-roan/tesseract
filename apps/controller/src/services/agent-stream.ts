import type { AgentRunEvent, AgentRunUsage } from "@tesseract/protocol";

export type AgentEventBody =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; tool: string; summary: string }
  | { kind: "tool_result"; tool: string | null; isError: boolean; summary: string }
  | { kind: "system"; text: string };

export type AgentStreamResult = {
  isError: boolean;
  result: string | null;
  usage: AgentRunUsage | null;
  subtype: string | null;
};

export type AgentStreamUpdate = {
  events: AgentEventBody[];
  sessionId?: string;
  result?: AgentStreamResult;
};

type Json = Record<string, unknown>;

const SUMMARY_LENGTH = 200;
const INPUT_KEYS = ["command", "file_path", "path", "pattern", "url", "query", "description", "prompt", "notebook_path"];

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);
const tokenCount = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/** Maps the `usage` object of a `result` message (Anthropic API field names) to AgentRunUsage; null when absent. */
function parseUsage(value: unknown): AgentRunUsage | null {
  if (!isObject(value)) return null;
  const inputTokens = tokenCount(value.input_tokens);
  const outputTokens = tokenCount(value.output_tokens);
  const cacheReadTokens = tokenCount(value.cache_read_input_tokens);
  const cacheWriteTokens = tokenCount(value.cache_creation_input_tokens);
  const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens };
}

export function truncate(text: string, length = SUMMARY_LENGTH): string {
  const single = text.replace(/\s+/g, " ").trim();
  return single.length > length ? `${single.slice(0, length - 1)}…` : single;
}

export function summarizeToolInput(tool: string, input: unknown): string {
  if (!isObject(input)) return "";
  if (tool === "TodoWrite" && Array.isArray(input.todos)) return `${input.todos.length} todos`;
  for (const key of INPUT_KEYS) {
    const value = asString(input[key]);
    if (value) return truncate(value);
  }
  return truncate(JSON.stringify(input));
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (isObject(part) && part.type === "text" ? (asString(part.text) ?? "") : ""))
    .filter(Boolean)
    .join("\n");
}

/**
 * Maps Claude Code `--output-format stream-json` messages to AgentRunEvent
 * bodies. Unknown message types are ignored so newer CLI versions keep working.
 */
export class AgentStreamParser {
  private readonly toolNames = new Map<string, string>();

  parseLine(line: string): AgentStreamUpdate | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) return null;
    let message: unknown;
    try {
      message = JSON.parse(trimmed);
    } catch {
      return null;
    }
    return isObject(message) ? this.parseMessage(message) : null;
  }

  parseMessage(message: Json): AgentStreamUpdate | null {
    const sessionId = asString(message.session_id) ?? undefined;
    switch (message.type) {
      case "system":
        return this.system(message, sessionId);
      case "assistant":
        return { events: this.assistant(message), sessionId };
      case "user":
        return { events: this.toolResults(message), sessionId };
      case "result":
        return this.result(message, sessionId);
      default:
        return sessionId ? { events: [], sessionId } : null;
    }
  }

  private system(message: Json, sessionId: string | undefined): AgentStreamUpdate {
    if (message.subtype !== "init") return { events: [], sessionId };
    const model = asString(message.model);
    const cwd = asString(message.cwd);
    const details = [model && `model ${model}`, cwd && `cwd ${cwd}`].filter(Boolean).join(", ");
    return { events: [{ kind: "system", text: `Session started${details ? ` (${details})` : ""}` }], sessionId };
  }

  private assistant(message: Json): AgentEventBody[] {
    const inner = isObject(message.message) ? message.message : null;
    const content = Array.isArray(inner?.content) ? inner.content : [];
    const events: AgentEventBody[] = [];
    for (const block of content) {
      if (!isObject(block)) continue;
      if (block.type === "text") {
        const text = asString(block.text);
        if (text?.trim()) events.push({ kind: "text", text });
      } else if (block.type === "tool_use") {
        const tool = asString(block.name) ?? "tool";
        const id = asString(block.id);
        if (id) this.toolNames.set(id, tool);
        events.push({ kind: "tool_use", tool, summary: summarizeToolInput(tool, block.input) });
      }
    }
    return events;
  }

  private toolResults(message: Json): AgentEventBody[] {
    const inner = isObject(message.message) ? message.message : null;
    const content = Array.isArray(inner?.content) ? inner.content : [];
    const events: AgentEventBody[] = [];
    for (const block of content) {
      if (!isObject(block) || block.type !== "tool_result") continue;
      const id = asString(block.tool_use_id);
      events.push({
        kind: "tool_result",
        tool: id ? (this.toolNames.get(id) ?? null) : null,
        isError: block.is_error === true,
        summary: truncate(resultText(block.content)),
      });
    }
    return events;
  }

  private result(message: Json, sessionId: string | undefined): AgentStreamUpdate {
    const subtype = asString(message.subtype);
    const isError = message.is_error === true || (subtype !== null && subtype !== "success");
    const usage = parseUsage(message.usage);
    const duration = typeof message.duration_ms === "number" ? ` in ${(message.duration_ms / 1000).toFixed(1)} s` : "";
    const turns = typeof message.num_turns === "number" ? `, ${message.num_turns} turns` : "";
    const tokens = usage ? `, ${usage.totalTokens.toLocaleString("en-US")} tokens` : "";
    return {
      sessionId,
      events: [{ kind: "system", text: `${isError ? `Run failed (${subtype ?? "error"})` : "Run finished"}${duration}${turns}${tokens}` }],
      result: { isError, result: asString(message.result), usage, subtype },
    };
  }
}

export function toEvent(body: AgentEventBody, seq: number, ts: string): AgentRunEvent {
  return { ...body, seq, ts } as AgentRunEvent;
}
