import { ApiError } from "@theone/client";
import {
  GIT_REF_PATTERN,
  GIT_URL_PATTERN,
  isFinalBuildState,
  projectIdFromName,
  type AgentRun,
  type Artifact,
  type BuildJob,
  type BuildProfile,
  type BuildTarget,
  type ClaudeAccountList,
  type Framework,
  type GitSummary,
  type ProcessInfo,
  type Project,
  type SyncChanges,
} from "@theone/protocol";
import { cleanLogText } from "../../components/LogView";
import { formatRelativeTime, joinMeta, parseTime } from "./format";
import {
  CONFLICT_STATUS,
  DEFAULT_CLAUDE_ACCOUNT,
  DIGITS,
  FIX_LOG_TAIL,
  GROUP_ORDER,
  GUI_FRAMEWORKS,
  LIVE_PROCESS_STATES,
  MAX_COMMAND_LENGTH,
  MAX_GIT_URL_LENGTH,
  MAX_NAME_LENGTH,
  PARAGRAPH,
  PORT_RANGE,
  PROJECTS_ROOT,
  REMOVAL_PATH_PREVIEW,
} from "./constants";
import {
  ACTIVITY_LABELS,
  BUILD_STATE_LABELS,
  BUILD_TARGET_LABELS,
  CLAUDE_ACCOUNT_LABELS,
  CONFIDENTIAL_LABEL,
  CREATE_LABELS,
  FIX_LABELS,
  FRAMEWORK_FALLBACK,
  FRAMEWORK_LABELS,
  GIT_LABELS,
  GROUP_LABELS,
  LOG_LABELS,
  PROFILE_LABELS,
  REMOVE_LABELS,
} from "./labels";
import type {
  Activity,
  CardGroup,
  CardModel,
  ChoiceModel,
  CloneOutcome,
  ListTab,
  LogStatus,
  ProcessDraft,
  ProcessDraftError,
  ProcessFieldKey,
  ProjectDraft,
  ProjectDraftError,
  RemovalPrompt,
  ToneLabel,
  ValidatedProcessDraft,
  ValidatedProjectDraft,
  FieldKey,
} from "./types";

export { projectIdFromName };

export function validateProjectDraft(draft: ProjectDraft, existingIds: Iterable<string>): ValidatedProjectDraft {
  const name = draft.name.trim();
  const gitUrl = draft.gitUrl.trim();
  const branch = draft.branch.trim();
  const errors: Partial<Record<FieldKey, ProjectDraftError>> = {};
  const projectId = projectIdFromName(name);
  const existing = new Set(existingIds);
  if (!name) errors.name = "name_required";
  else if (name.length > MAX_NAME_LENGTH) errors.name = "name_too_long";
  else if (!projectId) errors.name = "name_invalid";
  else if (existing.has(projectId)) errors.name = "name_exists";
  if (gitUrl && (gitUrl.length > MAX_GIT_URL_LENGTH || !GIT_URL_PATTERN.test(gitUrl))) errors.git_url = "git_url";
  if (branch) {
    if (!gitUrl) errors.branch = "branch_needs_url";
    else if (!GIT_REF_PATTERN.test(branch)) errors.branch = "branch_invalid";
  }
  const ok = Object.keys(errors).length === 0 && projectId !== null;
  return {
    errors,
    projectId,
    name,
    gitUrl: gitUrl || null,
    branch: gitUrl && branch ? branch : null,
    confidential: draft.confidential,
    ok,
  };
}

export function locationHint(name: string, root = PROJECTS_ROOT): string {
  const id = projectIdFromName(name);
  return id ? CREATE_LABELS.location(root, id) : CREATE_LABELS.locationEmpty(root);
}

export function createLabel(gitUrl: string): string {
  return gitUrl.trim() ? CREATE_LABELS.clone : CREATE_LABELS.create;
}

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && (error.status === CONFLICT_STATUS || error.code === "conflict");
}

export function cloneOutcome(code: number | null, finished: boolean): CloneOutcome {
  if (!finished) return { label: CREATE_LABELS.cloning, tone: "info", message: "" };
  if (code === 0) return { label: CREATE_LABELS.cloned, tone: "success", message: CREATE_LABELS.ready };
  const reason = code === null ? CREATE_LABELS.stopped : CREATE_LABELS.exitCode(code);
  return { label: CREATE_LABELS.failed, tone: "danger", message: `${reason} ${CREATE_LABELS.keepFolder}` };
}

export function renameError(name: string): "name_too_long" | null {
  return name.trim().length > MAX_NAME_LENGTH ? "name_too_long" : null;
}

export function renameValue(name: string): string | null {
  return name.trim() || null;
}

export function removalPrompt(name: string, sync: Pick<SyncChanges, "baselineAt" | "changes" | "host">): RemovalPrompt {
  const host = sync.host?.name || REMOVE_LABELS.yourComputer;
  if (sync.baselineAt === null) {
    return { heading: REMOVE_LABELS.onlyCopyHeading, body: REMOVE_LABELS.onlyCopyBody(name), confirm: REMOVE_LABELS.forceDelete, force: true };
  }
  const count = sync.changes.length;
  if (count > 0) {
    const files = count === 1 ? REMOVE_LABELS.file(count) : REMOVE_LABELS.files(count);
    const verb = count === 1 ? REMOVE_LABELS.verbOne : REMOVE_LABELS.verbMany;
    const shown = sync.changes.slice(0, REMOVAL_PATH_PREVIEW).map((change) => change.path).join(", ");
    const extra = count - REMOVAL_PATH_PREVIEW;
    const paths = extra > 0 ? REMOVE_LABELS.more(shown, extra) : shown;
    return {
      heading: REMOVE_LABELS.unsyncedHeading,
      body: REMOVE_LABELS.unsyncedBody(files, name, verb, host, paths),
      confirm: REMOVE_LABELS.forceDelete,
      force: true,
    };
  }
  return { heading: REMOVE_LABELS.deleteHeading(name), body: REMOVE_LABELS.deleteBody(host), confirm: REMOVE_LABELS.delete, force: false };
}

export function validateProcessDraft(draft: ProcessDraft, projectId: string): ValidatedProcessDraft {
  const command = draft.command.trim();
  const name = draft.name.trim();
  const port = draft.port.trim();
  const errors: Partial<Record<ProcessFieldKey, ProcessDraftError>> = {};
  if (!command) errors.command = "command_required";
  else if (command.length > MAX_COMMAND_LENGTH) errors.command = "command_too_long";
  if (name.length > MAX_NAME_LENGTH) errors.name = "name_too_long";
  const portNumber = Number(port);
  if (port && (!DIGITS.test(port) || portNumber < PORT_RANGE.min || portNumber > PORT_RANGE.max)) errors.port = "port_invalid";
  const body: ValidatedProcessDraft["body"] = { projectId, command };
  if (name) body.name = name;
  if (port && !errors.port) body.port = portNumber;
  if (draft.display) body.display = true;
  return { errors, body, ok: Object.keys(errors).length === 0 };
}

export function prefersDisplay(framework: Framework | null | undefined): boolean {
  return framework !== null && framework !== undefined && GUI_FRAMEWORKS.includes(framework);
}

export function frameworkLabel(framework: Framework | string | null | undefined): string {
  return (framework && FRAMEWORK_LABELS[framework as Framework]) || FRAMEWORK_FALLBACK;
}

export function targetLabel(target: BuildTarget | string): string {
  return BUILD_TARGET_LABELS[target as BuildTarget]?.[0] ?? target;
}

export function profileLabel(profile: BuildProfile | string): string {
  return PROFILE_LABELS[profile as BuildProfile] ?? profile;
}

export function syncLabel(ahead: number, behind: number): string | null {
  const parts = [ahead ? GIT_LABELS.ahead(ahead) : "", behind ? GIT_LABELS.behind(behind) : ""].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

export function dirtyBadge(git: GitSummary | null | undefined, changes?: number | null): ToneLabel | null {
  if (!git) return null;
  if (!git.dirty) return { label: GIT_LABELS.clean, tone: "success" };
  return { label: changes ? GIT_LABELS.changed(changes) : GIT_LABELS.dirty, tone: "warning" };
}

export function isLiveProcess(process: Pick<ProcessInfo, "state">): boolean {
  return LIVE_PROCESS_STATES.includes(process.state);
}

export function projectActivity(id: string, processes: readonly ProcessInfo[], builds: readonly BuildJob[], runs: readonly AgentRun[]): Activity {
  const running = processes.filter((process) => process.projectId === id && isLiveProcess(process)).length;
  if (runs.some((run) => run.projectId === id && run.state === "running")) {
    return { kind: "agent", label: ACTIVITY_LABELS.agent, tone: "info", running };
  }
  if (builds.some((build) => build.projectId === id && !isFinalBuildState(build.state))) {
    return { kind: "building", label: ACTIVITY_LABELS.building, tone: "info", running };
  }
  if (running > 0) return { kind: "running", label: ACTIVITY_LABELS.running(running), tone: "success", running };
  return { kind: "idle", label: ACTIVITY_LABELS.idle, tone: "neutral", running };
}

export function activityTimestamp(project: Project, processes: readonly ProcessInfo[], builds: readonly BuildJob[], runs: readonly AgentRun[]): number {
  const stamps: (string | null | undefined)[] = [project.git?.lastCommit?.date];
  for (const process of processes) if (process.projectId === project.id) stamps.push(process.startedAt, process.endedAt);
  for (const build of builds) if (build.projectId === project.id) stamps.push(build.createdAt, build.endedAt);
  for (const run of runs) if (run.projectId === project.id) stamps.push(run.startedAt, run.endedAt);
  return stamps.reduce<number>((max, stamp) => Math.max(max, parseTime(stamp) ?? 0), 0);
}

export function sortProjects(projects: readonly Project[], processes: readonly ProcessInfo[], builds: readonly BuildJob[], runs: readonly AgentRun[]): Project[] {
  const keyed = projects.map((project) => ({
    project,
    busy: projectActivity(project.id, processes, builds, runs).kind !== "idle",
    stamp: activityTimestamp(project, processes, builds, runs),
    name: project.name.toLowerCase(),
  }));
  keyed.sort((a, b) => Number(b.busy) - Number(a.busy) || b.stamp - a.stamp || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return keyed.map((entry) => entry.project);
}

export function matches(project: Project, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = [
    project.name,
    project.id,
    frameworkLabel(project.framework),
    project.git?.branch ?? "",
    project.packageManager ?? "",
    ...project.buildTargets,
    project.confidential ? CONFIDENTIAL_LABEL : "",
  ]
    .join(" ")
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export function inTab(activity: Pick<Activity, "kind">, tab: ListTab): boolean {
  if (tab === "active") return activity.kind !== "idle";
  if (tab === "idle") return activity.kind === "idle";
  return true;
}

export function groupByActivity(cards: readonly CardModel[]): CardGroup[] {
  return GROUP_ORDER.map((id) => ({ id, title: GROUP_LABELS[id], cards: cards.filter((card) => card.activity.kind === id) })).filter(
    (group) => group.cards.length > 0,
  );
}

export function cardModel(project: Project, processes: readonly ProcessInfo[], builds: readonly BuildJob[], runs: readonly AgentRun[], now: number = Date.now()): CardModel {
  const git = project.git;
  const lastCommit = git?.lastCommit ?? null;
  return {
    id: project.id,
    title: project.name || project.id,
    subtitle: joinMeta(frameworkLabel(project.framework), project.packageManager, project.id),
    activity: projectActivity(project.id, processes, builds, runs),
    branch: git ? git.branch || GIT_LABELS.detached : GIT_LABELS.notRepo,
    sync: git ? syncLabel(git.ahead, git.behind) : null,
    dirty: dirtyBadge(git),
    commit: lastCommit ? lastCommit.subject || null : git ? GIT_LABELS.noCommits : null,
    commitWhen: formatRelativeTime(lastCommit?.date, now),
    tags: project.buildTargets.map(targetLabel),
    confidential: project.confidential ? { label: CONFIDENTIAL_LABEL, tone: "warning" } : null,
  };
}

const newestFirst = (a: string | null | undefined, b: string | null | undefined) => (parseTime(b) ?? 0) - (parseTime(a) ?? 0);

export function projectProcesses(processes: readonly ProcessInfo[], projectId?: string): ProcessInfo[] {
  return processes
    .filter((process) => projectId === undefined || process.projectId === projectId)
    .sort((a, b) => newestFirst(a.startedAt, b.startedAt))
    .sort((a, b) => Number(isLiveProcess(b)) - Number(isLiveProcess(a)));
}

export function projectBuilds(builds: readonly BuildJob[], projectId?: string): BuildJob[] {
  return builds.filter((build) => projectId === undefined || build.projectId === projectId).sort((a, b) => newestFirst(a.createdAt, b.createdAt));
}

export function projectArtifacts(artifacts: readonly Artifact[], projectId?: string): Artifact[] {
  return artifacts
    .filter((artifact) => projectId === undefined || artifact.projectId === projectId)
    .sort((a, b) => newestFirst(a.createdAt, b.createdAt));
}

export function runningCount(processes: readonly ProcessInfo[]): number {
  return processes.filter(isLiveProcess).length;
}

export function activeBuildCount(builds: readonly BuildJob[]): number {
  return builds.filter((build) => !isFinalBuildState(build.state)).length;
}

export function effectiveAccount(project: Pick<Project, "claudeAccountId">, accounts: Pick<ClaudeAccountList, "defaultAccountId">): string {
  return project.claudeAccountId || accounts.defaultAccountId;
}

export function claudeAccountOptions(project: Pick<Project, "claudeAccountId">, accounts: ClaudeAccountList): ChoiceModel[] {
  const options: ChoiceModel[] = [{ id: DEFAULT_CLAUDE_ACCOUNT, label: CLAUDE_ACCOUNT_LABELS.defaultOption(accounts.defaultAccountId) }];
  for (const profile of accounts.accounts) options.push({ id: profile.id, label: joinMeta(profile.id, profile.account?.email) });
  const pinned = project.claudeAccountId;
  if (pinned && !accounts.accounts.some((profile) => profile.id === pinned)) options.push({ id: pinned, label: pinned });
  return options;
}

export function claudeAccountLabel(project: Pick<Project, "claudeAccountId">, accounts: ClaudeAccountList | null): string | null {
  if (!accounts) return null;
  const effective = effectiveAccount(project, accounts);
  return effective ? CLAUDE_ACCOUNT_LABELS.chip(effective) : null;
}

export interface FailureFacts {
  command?: string | null;
  exitCode?: number | null;
  error?: string | null;
}

export function failurePrompt(subject: string, lines: readonly { text: string }[], facts: FailureFacts = {}): string {
  const factLines = [
    facts.command ? FIX_LABELS.command(facts.command) : "",
    facts.exitCode !== null && facts.exitCode !== undefined ? FIX_LABELS.exitCode(facts.exitCode) : "",
    facts.error ? FIX_LABELS.error(facts.error) : "",
  ].filter(Boolean);
  const tail = lines.slice(-FIX_LOG_TAIL);
  const log = tail.map((line) => cleanLogText(line.text)).join("\n").trim();
  const parts = [FIX_LABELS.failed(subject), factLines.join("\n"), log ? FIX_LABELS.log(tail.length, log) : FIX_LABELS.noLog];
  return parts.filter(Boolean).join(PARAGRAPH);
}

export function processFailurePrompt(process: Pick<ProcessInfo, "id" | "name" | "command" | "exitCode">, lines: readonly { text: string }[]): string {
  const command = Array.isArray(process.command) ? process.command.join(" ") : process.command;
  return failurePrompt(FIX_LABELS.processSubject(process.name || process.id), lines, { command, exitCode: process.exitCode });
}

export function buildFailurePrompt(build: Pick<BuildJob, "target" | "profile" | "error">, lines: readonly { text: string }[]): string {
  const subject = FIX_LABELS.buildSubject(targetLabel(build.target), profileLabel(build.profile).toLowerCase()).replace(/\s+/g, " ");
  return failurePrompt(subject, lines, { error: build.error });
}

export function canFixProcess(process: Pick<ProcessInfo, "state" | "exitCode">): boolean {
  return process.state === "failed" || (process.state === "exited" && process.exitCode !== null && process.exitCode !== 0);
}

export function canFixBuild(build: Pick<BuildJob, "state">): boolean {
  return build.state === "failed";
}

export type LogConnectionState = "open" | "connecting" | "closed";

export function logStatus(state: LogConnectionState | string, exitCode: number | null = null, ended = false): LogStatus {
  if (ended) {
    if (exitCode === null) return { label: LOG_LABELS.stopped, tone: "neutral", live: false };
    return { label: LOG_LABELS.exited(exitCode), tone: exitCode === 0 ? "success" : "danger", live: false };
  }
  if (state === "open") return { label: LOG_LABELS.live, tone: "success", live: true };
  if (state === "connecting") return { label: LOG_LABELS.connecting, tone: "warning", live: false };
  return { label: LOG_LABELS.ended, tone: "neutral", live: false };
}

export function buildStateStatus(state: BuildJob["state"]): LogStatus | null {
  if (state === "succeeded") return { label: BUILD_STATE_LABELS.succeeded, tone: "success", live: false };
  if (state === "failed") return { label: BUILD_STATE_LABELS.failed, tone: "danger", live: false };
  if (state === "cancelled") return { label: BUILD_STATE_LABELS.cancelled, tone: "warning", live: false };
  return null;
}

export function upsertById<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [item, ...list];
  const next = list.slice();
  next[index] = item;
  return next;
}

export function removeById<T extends { id: string }>(list: readonly T[], id: string): T[] {
  return list.filter((entry) => entry.id !== id);
}
