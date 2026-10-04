import {
  isFinalProcessState,
  type BuildJob,
  type Framework,
  type GitFileStatus,
  type GitSummary,
  type PackageManager,
  type ProcessCommand,
  type ProcessInfo,
  type Project,
} from "@theone/protocol";

import type { Tone } from "@/lib/tone";

import { DEFAULT_PACKAGE_MANAGER } from "./constants";
import { pluralize } from "./format";
import { frameworkLabel } from "./labels";

const GUI_FRAMEWORKS: ReadonlySet<Framework> = new Set(["electron"]);
const SHELL_SAFE_WORD = /^[\w.:@/+=-]+$/;

const shellWord = (value: string) => (SHELL_SAFE_WORD.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`);

export function scriptCommand(packageManager: PackageManager | null, script: string): string {
  return `${packageManager ?? DEFAULT_PACKAGE_MANAGER} run ${shellWord(script)}`;
}

/** The command the Run button starts: installs dependencies first when `node_modules` is missing. */
export function runScriptCommand(project: Pick<Project, "packageManager" | "dependenciesInstalled">, script: string): string {
  const run = scriptCommand(project.packageManager, script);
  return project.dependenciesInstalled === false ? `${project.packageManager ?? DEFAULT_PACKAGE_MANAGER} install && ${run}` : run;
}

export function commandLabel(command: ProcessCommand): string {
  return typeof command === "string" ? command : command.join(" ");
}

export function isActiveProcess(process: ProcessInfo): boolean {
  return !isFinalProcessState(process.state);
}

export function prefersDisplay(framework: Framework): boolean {
  return GUI_FRAMEWORKS.has(framework);
}

export function buildShortcutProject(builds: readonly BuildJob[] | undefined, projects: readonly Project[] | undefined): string | null {
  const buildable = (projects ?? []).filter((project) => project.buildTargets.length > 0);
  const recent = (builds ?? []).find((build) => buildable.some((project) => project.id === build.projectId));
  return recent?.projectId ?? buildable[0]?.id ?? null;
}

export function gitSummaryLabel(git: GitSummary | null): string {
  if (!git) return "Not a git repository";
  const parts = [git.branch ?? "detached"];
  if (git.ahead) parts.push(`${git.ahead} ahead`);
  if (git.behind) parts.push(`${git.behind} behind`);
  parts.push(git.dirty ? "uncommitted changes" : "clean");
  return parts.join(" · ");
}

export function projectSubtitle(project: Project): string {
  const targets = project.buildTargets.length ? pluralize(project.buildTargets.length, "build target") : null;
  return [frameworkLabel(project.framework), project.git?.branch, project.git?.dirty ? "uncommitted changes" : null, targets]
    .filter(Boolean)
    .join(" · ");
}

export function gitFileCode(file: GitFileStatus): string {
  const code = `${file.index}${file.worktree}`.trim();
  return code || "?";
}

export function gitFileTone(file: GitFileStatus): Tone {
  const code = gitFileCode(file);
  if (code.includes("?")) return "neutral";
  if (code.includes("U") || code.includes("D")) return "danger";
  if (code.includes("A")) return "success";
  return "warning";
}

export function gitBadge(summary: GitSummary | null, changes: number): { label: string; tone: Tone } | undefined {
  if (!summary) return undefined;
  return summary.dirty ? { label: pluralize(changes, "change"), tone: "warning" } : { label: "Clean", tone: "success" };
}
