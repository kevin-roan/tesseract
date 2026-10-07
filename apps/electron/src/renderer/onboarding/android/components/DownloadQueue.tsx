import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../../../components/Icon";
import { SettingsGroup } from "../../../components/PreferenceRows";
import { Spinner } from "../../../components/Spinner";
import { rise, stagger, STAGGER_MS } from "../../../theme/motion";
import { CHECK_GLYPH_VARIANTS } from "../../shell/motion";
import { LogDisclosure, ProgressBlock } from "../../shell";
import { ANDROID_LABELS } from "../labels";
import type { QueueItem } from "../model";
import styles from "./DownloadQueue.module.css";

export interface DownloadQueueProps {
  items: readonly QueueItem[];
  log: readonly string[];
}

function QueueGlyph({ state }: { state: QueueItem["state"] }) {
  return (
    <span className={styles.glyph} data-state={state}>
      <AnimatePresence initial={false}>
        <motion.span key={state} className={styles.glyphLayer} variants={CHECK_GLYPH_VARIANTS} initial="initial" animate="animate" exit="exit">
          {state === "active" ? <Spinner size={16} /> : <Icon name={state === "done" ? "success" : "status-todo"} />}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function DownloadQueue({ items, log }: DownloadQueueProps) {
  return (
    <>
      <SettingsGroup title={ANDROID_LABELS.queue.title} description={ANDROID_LABELS.queue.description}>
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            className={styles.item}
            data-state={item.state}
            variants={rise}
            initial="initial"
            animate="animate"
            transition={stagger(index, STAGGER_MS.checks)}
          >
            <QueueGlyph state={item.state} />
            <div className={styles.progress}>
              <ProgressBlock label={item.label} progress={item.progress} detail={item.detail} tone={item.state === "done" ? "success" : "info"} />
            </div>
          </motion.div>
        ))}
      </SettingsGroup>
      <LogDisclosure lines={log} />
    </>
  );
}
