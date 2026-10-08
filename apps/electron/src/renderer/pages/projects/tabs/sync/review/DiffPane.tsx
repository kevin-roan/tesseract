import type { SyncFileChange } from "@tesseract/protocol";
import { AnimatePresence, motion } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import { Text } from "../../../../../components/Text";
import { cssVar, TONE_COLORS } from "../../../../../theme/colors";
import { fade } from "../../../../../theme/motion";
import { SYNC_LABELS, SYNC_REVIEW_LABELS } from "../labels";
import { syncChangeCode } from "../model";
import { DiffLineRow } from "./DiffLineRow";
import type { DiffDisplay } from "./model";
import { StartEllipsis } from "./StartEllipsis";
import styles from "./SyncReview.module.css";

export interface DiffPaneProps {
  change: SyncFileChange | null;
  conflict: boolean;
  display: DiffDisplay;
}

export function DiffPane({ change, conflict, display }: DiffPaneProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const tone = change ? syncChangeCode(change.kind) : null;
  const lines = display.kind === "lines" ? display : null;

  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [change?.path, display.kind]);

  return (
    <div className={styles.diff}>
      <div className={styles.diffHeader}>
        {change && tone ? (
          <>
            <span className={styles.code} style={{ color: cssVar(TONE_COLORS[tone.tone].fg) }}>
              {tone.code}
            </span>
            <StartEllipsis text={change.path} title={change.path} className={styles.diffPath} />
            <Text variant="caption" color={conflict ? "warning" : "text-secondary"}>
              {conflict ? SYNC_LABELS.conflictBadge : SYNC_REVIEW_LABELS.kinds[change.kind]}
            </Text>
            {lines ? (
              <>
                <span className={styles.added}>{SYNC_REVIEW_LABELS.added(lines.added)}</span>
                <span className={styles.removed}>{SYNC_REVIEW_LABELS.removed(lines.removed)}</span>
              </>
            ) : null}
          </>
        ) : null}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${change?.path ?? ""}:${display.kind === "message" ? display.message : "lines"}`}
          className={styles.diffBody}
          variants={fade}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {lines ? (
            <div ref={scroller} role="list" aria-label={SYNC_REVIEW_LABELS.lines} className={styles.lines}>
              {lines.lines.map((line, index) => (
                <DiffLineRow key={index} line={line} />
              ))}
            </div>
          ) : (
            <div className={styles.message}>
              <Text variant="body" color="text-secondary" wrap lines={null} center>
                {display.kind === "message" ? display.message : ""}
              </Text>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {lines?.footnote ? (
        <Text variant="caption" color="text-tertiary" center className={styles.footnote}>
          {lines.footnote}
        </Text>
      ) : null}
    </div>
  );
}
