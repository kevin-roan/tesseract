export type AttachKind = "files" | "images" | "paste";

export interface SlashCommand {
  command: string;
  description?: string;
}

export interface SubmitState {
  text: string;
  hasAttachments?: boolean;
  busy?: boolean;
  locked?: boolean;
  attachmentsBlocked?: boolean;
}

export function canSubmitComposer({ text, hasAttachments = false, busy = false, locked = false, attachmentsBlocked = false }: SubmitState): boolean {
  return (text.trim() !== "" || hasAttachments) && !busy && !locked && !attachmentsBlocked;
}

export interface KeyLike {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

export function isSubmitKey(event: KeyLike): boolean {
  if (event.isComposing || event.keyCode === 229) return false;
  return event.key === "Enter" && !event.shiftKey;
}

const SLASH_QUERY = /^\/(\S*)$/;

export function slashQuery(text: string): string | null {
  const match = SLASH_QUERY.exec(text);
  return match ? (match[1] ?? "").toLowerCase() : null;
}

export function matchSlashCommands(text: string, commands: readonly SlashCommand[], limit: number): SlashCommand[] {
  const query = slashQuery(text);
  if (query === null) return [];
  const normalized = (command: string) => command.replace(/^\//, "").toLowerCase();
  return commands.filter((entry) => normalized(entry.command).startsWith(query)).slice(0, limit);
}

export function completeSlashCommand(command: SlashCommand): string {
  return `/${command.command.replace(/^\//, "")} `;
}

export function clampHeight(content: number, min: number, max: number): number {
  return Math.min(Math.max(content, min), max);
}

export function wrapIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return ((index % length) + length) % length;
}

export function middleEllipsis(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  return `${chars.slice(0, head).join("")}…${chars.slice(chars.length - (keep - head)).join("")}`;
}
