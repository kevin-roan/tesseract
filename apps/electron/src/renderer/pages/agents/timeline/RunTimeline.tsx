import type { AgentRun, AgentRunEvent } from "@theone/protocol";
import { useMemo, type Ref } from "react";
import { ThinkingRow, Timeline, type TimelineHandle } from "../../../components/Timeline";
import { cx } from "../../../lib/cx";
import { CONVERSATION_LABELS } from "../../../features/agents/labels";
import { NO_NAMES, NO_RUNS } from "./constants";
import { buildTimeline, firstTextKey } from "./model";
import { isRunning, previousRun, type NameLookup } from "./run-info";
import { TimelineEntry } from "./TimelineEntry";
import { TimelineIntro } from "./TimelineIntro";
import styles from "./RunTimeline.module.css";

export interface RunTimelineProps {
  run: AgentRun;
  events: readonly AgentRunEvent[];
  names?: NameLookup;
  runs?: readonly AgentRun[];
  now?: number;
  onSelectRun?: (runId: string) => void;
  className?: string;
  ref?: Ref<TimelineHandle>;
}

export function RunTimeline({ run, events, names = NO_NAMES, runs = NO_RUNS, now, onSelectRun, className, ref }: RunTimelineProps) {
  const items = useMemo(() => buildTimeline(run, events), [run, events]);
  const authorKey = firstTextKey(items);
  const previous = useMemo(() => previousRun(run, runs), [run, runs]);
  const running = isRunning(run);

  return (
    <Timeline
      ref={ref}
      resetKey={run.id}
      jumpLabel={CONVERSATION_LABELS.jump}
      className={cx(styles.timeline, className)}
      header={<TimelineIntro run={run} names={names} previous={previous} now={now} onSelectRun={onSelectRun} />}
      footer={running ? <ThinkingRow label={CONVERSATION_LABELS.waiting} /> : null}
    >
      {items.map((item) => (
        <TimelineEntry
          key={item.key}
          item={item}
          run={run}
          author={item.key === authorKey}
          working={running && item.key === authorKey}
          now={item.kind === "prompt" || item.kind === "outcome" ? now : undefined}
        />
      ))}
    </Timeline>
  );
}
