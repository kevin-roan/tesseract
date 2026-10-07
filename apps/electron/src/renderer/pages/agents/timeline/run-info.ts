import type { AgentRun } from "@theone/protocol";
import { CONTINUES_TITLE_LIMIT } from "../../../features/agents/constants";
import { formatRelativeTime, formatTokens, joinMeta } from "../../../features/agents/format";
import { CONVERSATION_LABELS, formatLabel } from "../../../features/agents/labels";
import { projectName, runDuration, runTitle, runTotalTokens, shortId, type ProjectNames } from "../../../features/agents/model";

export { formatBytes } from "../../../features/agents/format";
export {
  isFinal,
  plainText,
  previousRun,
  projectName,
  runDuration,
  runTitle,
  runTotalTokens as totalTokens,
  shortId,
  stateLabel,
  stateTone,
} from "../../../features/agents/model";

export type NameLookup = ProjectNames;

export function continuesLabel(previous: Pick<AgentRun, "prompt">): string {
  return formatLabel(CONVERSATION_LABELS.continues, { title: runTitle(previous.prompt, CONTINUES_TITLE_LIMIT) });
}

export function isRunning(run: Pick<AgentRun, "state"> | null | undefined): boolean {
  return run?.state === "running";
}

export function introMeta(run: AgentRun, names: NameLookup, now?: number): string {
  const session = run.sessionId ? formatLabel(CONVERSATION_LABELS.session, { id: shortId(run.sessionId) }) : null;
  return joinMeta(
    projectName(run.projectId, names),
    formatRelativeTime(run.startedAt, now),
    runDuration(run, now),
    formatTokens(runTotalTokens(run)),
    run.claudeAccountId,
    session,
  );
}

export function outcomeMeta(run: AgentRun, now?: number): string {
  return joinMeta(runDuration(run, now), formatTokens(runTotalTokens(run)));
}
