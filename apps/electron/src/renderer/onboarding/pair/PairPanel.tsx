import { motion } from "motion/react";
import { Notice } from "../../components/Notice";
import { LinkField, QrTile } from "../../components/PairDialog";
import { Text } from "../../components/Text";
import { popover } from "../../theme/motion";
import { PAIR_STEP_LABELS } from "./labels";
import styles from "./PairStep.module.css";

export interface PairPanelProps {
  link: string;
  local: boolean;
  caption: string;
  onCopy(link: string): void;
  onChangeReachability(): void;
}

export function PairPanel({ link, local, caption, onCopy, onChangeReachability }: PairPanelProps) {
  return (
    <div className={styles.panel}>
      {local ? (
        <Notice
          tone="warning"
          title={PAIR_STEP_LABELS.localTitle}
          message={PAIR_STEP_LABELS.localMessage}
          actionLabel={PAIR_STEP_LABELS.changeReachability}
          onAction={onChangeReachability}
        />
      ) : (
        <>
          <motion.div className={styles.qr} variants={popover} initial="initial" animate="animate">
            <QrTile value={link} label={PAIR_STEP_LABELS.qr} />
          </motion.div>
          <Text variant="body" color="text-secondary" wrap lines={null} center>
            {PAIR_STEP_LABELS.instructions}
          </Text>
        </>
      )}
      <LinkField value={link} copyLabel={PAIR_STEP_LABELS.copy} onCopy={onCopy} />
      <Text variant="caption" color="text-tertiary" center className={styles.caption}>
        {caption}
      </Text>
      <Notice tone="warning" message={PAIR_STEP_LABELS.secret} />
    </div>
  );
}
