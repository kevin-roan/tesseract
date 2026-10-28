import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Icon } from "../../../components/Icon";
import { RecordRow } from "../../../components/RecordRow";
import { Reveal } from "../../../components/Reveal";
import { Text } from "../../../components/Text";
import { ToneDot } from "../../../components/ToneDot";
import { RUNNING_WORK_LABELS as L } from "../../../features/agents/labels";
import { reveal } from "../../../theme/motion";
import { useRunningWork } from "./use-running-work";
import styles from "./Conversation.module.css";

export interface RunningWorkProps {
  projectId: string | null | undefined;
}

export function RunningWork({ projectId }: RunningWorkProps) {
  const { rows, count, stop } = useRunningWork(projectId);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const names = rows.map(({ row }) => row.title).join(" · ");
  return (
    <>
      <AnimatePresence initial={false}>
        {count > 0 ? (
          <motion.div key="running" className={styles.dock} variants={reveal} initial="initial" animate="animate" exit="exit">
            <section className={styles.running} aria-label={L.title} data-open={open || undefined}>
              <button
                type="button"
                className={styles.runningToggle}
                aria-expanded={open}
                aria-controls={listId}
                aria-label={open ? L.hide : L.show}
                onClick={() => setOpen((value) => !value)}
              >
                <ToneDot tone="success" size={7} live />
                <Text variant="label" className={styles.runningSummary}>
                  {L.summary(count)}
                </Text>
                <Text variant="caption" color="text-tertiary" className={styles.runningNames}>
                  {names}
                </Text>
                <Icon name="caret-down" className={styles.runningCaret} />
              </button>
              <Reveal open={open} id={listId}>
                <div className={styles.runningRows}>
                  {rows.map(({ id, row }) => (
                    <RecordRow key={id} {...row} />
                  ))}
                </div>
              </Reveal>
            </section>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <ConfirmDialog
        open={stop.open}
        heading={stop.heading}
        body={L.stopBody}
        confirmLabel={L.stopConfirm}
        cancelLabel={L.cancel}
        onConfirm={stop.confirm}
        onClose={stop.close}
      />
    </>
  );
}
