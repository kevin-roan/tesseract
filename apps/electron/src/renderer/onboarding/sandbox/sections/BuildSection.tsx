import { motion } from "motion/react";
import type { BuildMode, BuildPhase } from "../../../../shared/contracts/sandbox";
import { SettingsGroup } from "../../../components/PreferenceRows";
import { Text } from "../../../components/Text";
import { rise } from "../../../theme/motion";
import { LogDisclosure, ProgressBlock } from "../../shell";
import { SANDBOX_STEP_LABELS } from "../labels";
import { buildRows, progressView, stepCounter, trackDurations, type BuildTrack } from "../model";
import { PhaseRow } from "../parts/PhaseRow";
import styles from "../SandboxStep.module.css";

export interface BuildSectionProps {
  phase: BuildPhase;
  source: BuildMode;
  track: BuildTrack;
  log: readonly string[];
  now: number;
}

export function BuildSection({ phase, source, track, log, now }: BuildSectionProps) {
  const view = progressView(phase, track.lastFraction, now);
  const rows = buildRows(phase, source, track.lastIndex, trackDurations(track, now));
  const counter = stepCounter(phase);
  const failed = phase.kind === "failed";
  return (
    <motion.section
      className={styles.build}
      variants={rise}
      initial="initial"
      animate="animate"
      aria-label={SANDBOX_STEP_LABELS.build.title}
    >
      <ProgressBlock label={view.label} progress={view.fraction} detail={view.detail} tone={view.tone} />
      {counter ? (
        <Text variant="caption" color="text-tertiary" tabular className={styles.counter}>
          {counter}
        </Text>
      ) : null}
      <SettingsGroup>
        {rows.map((row, index) => (
          <PhaseRow key={row.id} title={row.title} status={row.status} caption={row.caption} index={index} />
        ))}
      </SettingsGroup>
      <LogDisclosure key={failed ? "failed" : "live"} lines={log} defaultOpen={failed} />
    </motion.section>
  );
}
