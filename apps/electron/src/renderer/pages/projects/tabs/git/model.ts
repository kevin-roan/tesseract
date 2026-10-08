import type { GitCommit, GitDetails, GitFileStatus, Project } from "@tesseract/protocol";
import type { Tone } from "../../../../theme/colors";
import { formatRelativeTime, joinMeta } from "../../../../features/projects/format";
import { SHORT_SHA_LENGTH, UNKNOWN_GIT_CODE } from "./constants";
import { GIT_CHANGE_NAMES, GIT_LABELS } from "./labels";

export function shortSha(sha: string): string {
  return sha.slice(0, SHORT_SHA_LENGTH);
}

export function syncLabel(ahead: number, behind: number): string | null {
  const parts: string[] = [];
  if (ahead) parts.push(GIT_LABELS.ahead(ahead));
  if (behind) parts.push(GIT_LABELS.behind(behind));
  return parts.join(" ") || null;
}

export function gitFileCode(file: GitFileStatus): string {
  return `${file.index ?? ""}${file.worktree ?? ""}`.trim() || UNKNOWN_GIT_CODE;
}

export function gitFileTone(file: GitFileStatus): Tone {
  const code = gitFileCode(file);
  if (code.includes("?")) return "info";
  if (code.includes("U") || code.includes("D")) return "danger";
  if (code.includes("A")) return "success";
  return "warning";
}

export function gitFileKind(file: GitFileStatus): string {
  const code = gitFileCode(file);
  if (code.includes("U")) return GIT_CHANGE_NAMES.U ?? code;
  for (const letter of code.replace(/ /g, "")) {
    const name = GIT_CHANGE_NAMES[letter];
    if (name) return name;
  }
  return code;
}

export function commitTitle(commit: GitCommit): string {
  return commit.subject || shortSha(commit.sha);
}

export function commitMeta(commit: GitCommit, now = Date.now()): string {
  return joinMeta(shortSha(commit.sha), commit.author, formatRelativeTime(commit.date, now));
}

export type GitNotice = { message: string; tone: Tone } | null;

export interface GitTabView {
  hasGit: boolean;
  notice: GitNotice;
  subtitle: string;
  loading: boolean;
  files: GitFileStatus[];
  commits: GitCommit[];
}

export function gitTabView(project: Project | null, details: GitDetails | null, error: string | null): GitTabView {
  const summary = project?.git ?? null;
  if (!summary) {
    return { hasGit: false, notice: { message: GIT_LABELS.none, tone: "neutral" }, subtitle: "", loading: false, files: [], commits: [] };
  }
  const source = details ?? summary;
  const files = details?.files ?? [];
  const subtitle = joinMeta(
    source.branch || GIT_LABELS.detached,
    syncLabel(source.ahead ?? 0, source.behind ?? 0) ?? GIT_LABELS.inSync,
    details && files.length === 0 ? GIT_LABELS.clean : null,
  );
  return {
    hasGit: true,
    notice: error === null ? null : { message: GIT_LABELS.error(error), tone: "warning" },
    subtitle,
    loading: details === null && error === null,
    files,
    commits: details?.log ?? [],
  };
}
