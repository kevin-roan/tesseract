import { AnimatePresence, motion } from "motion/react";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { RecordRow } from "../../../components/RecordRow";
import { SectionHeader } from "../../../components/Section";
import { RUNNING_WORK_LABELS as L } from "../../../features/agents/labels";
import { reveal } from "../../../theme/motion";
import { useRunningWork } from "./use-running-work";
import styles from "./Conversation.module.css";

export interface RunningWorkProps {
  projectId: string | null | undefined;
}

export function RunningWork({ projectId }: RunningWorkProps) {
  const { rows, count, stop } = useRunningWork(projectId);
  return (
    <>
      <AnimatePresence initial={false}>
        {count > 0 ? (
          <motion.div key="running" className={styles.noticesReveal} variants={reveal} initial="initial" animate="animate" exit="exit">
            <section className={styles.running} aria-label={L.title}>
              <SectionHeader title={L.title} subtitle={L.subtitle(count)} />
              <div className={styles.runningRows}>
                {rows.map(({ id, row }) => (
                  <RecordRow key={id} {...row} />
                ))}
              </div>
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
