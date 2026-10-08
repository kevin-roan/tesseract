import type { AgentRun } from "@tesseract/protocol";
import { Icon } from "../../../components/Icon";
import { StatusBadge } from "../../../components/StatusBadge";
import { Text } from "../../../components/Text";
import { continuesLabel, introMeta, isRunning, stateLabel, stateTone, type NameLookup } from "./run-info";
import styles from "./RunTimeline.module.css";

export interface TimelineIntroProps {
  run: AgentRun;
  names: NameLookup;
  previous: AgentRun | null;
  now?: number;
  onSelectRun?: (runId: string) => void;
}

export function TimelineIntro({ run, names, previous, now, onSelectRun }: TimelineIntroProps) {
  return (
    <div className={styles.intro}>
      <div className={styles.introMeta}>
        <StatusBadge label={stateLabel(run.state)} tone={stateTone(run.state)} live={isRunning(run)} className={styles.badge} />
        <Text variant="caption" color="text-tertiary" wrap lines={2} className={styles.introText}>
          {introMeta(run, names, now)}
        </Text>
      </div>
      {previous ? (
        <button type="button" className={styles.previous} onClick={() => onSelectRun?.(previous.id)}>
          <Icon name="back" color="text-tertiary" />
          <Text variant="caption" color="text-secondary">
            {continuesLabel(previous)}
          </Text>
        </button>
      ) : null}
    </div>
  );
}
