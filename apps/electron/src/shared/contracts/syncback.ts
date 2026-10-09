import type { SyncRequest } from "@tesseract/protocol";
import type { DefineContract } from "../ipc-types";

export type SyncKind = "pull" | "revert" | "get";

export interface SyncBackState {
  revision: number;
  busy: string[];
}

export interface SyncSubmitOptions {
  force?: boolean;
  paths?: string[];
}

export interface SyncLinkSummary {
  projectId: string;
  hostPath: string;
  pushedAt: string | null;
  gotAt: string | null;
  confidential: boolean;
  files: number;
}

export interface SnapshotSummary {
  id: string;
  createdAt: string;
  entries: number;
  reverted: boolean;
  kind: string;
}

export interface HostChange {
  path: string;
  kind: "added" | "modified" | "deleted";
}

export interface FileDiffLine {
  kind: "context" | "add" | "del" | "hunk";
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

export type FileDiff =
  | { kind: "text"; path: string; lines: FileDiffLine[]; truncated: boolean }
  | { kind: "binary"; path: string; hostSize: number | null; sandboxSize: number | null }
  | { kind: "too_large"; path: string; size: number }
  | { kind: "error"; path: string; message: string };

export type HostGitAction = "pull" | "push";

export interface HostGitResult {
  action: HostGitAction;
  hostPath: string;
  output: string;
}

export type SyncBackContract = DefineContract<{
  methods: {
    state(): SyncBackState;
    submit(projectId: string, kind: SyncKind, options: SyncSubmitOptions): SyncRequest;
    links(): SyncLinkSummary[];
    snapshots(projectId: string): SnapshotSummary[];
    hostChanges(projectId: string): HostChange[];
    diff(projectId: string, path: string): FileDiff;
    hostGit(projectId: string, action: HostGitAction): HostGitResult;
  };
  events: {
    state: SyncBackState;
  };
}>;
