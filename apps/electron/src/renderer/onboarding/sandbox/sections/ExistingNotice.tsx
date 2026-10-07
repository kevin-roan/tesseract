import { motion } from "motion/react";
import type { ExistingSandbox } from "../../../../shared/contracts/sandbox";
import { Notice } from "../../../components/Notice";
import { rise } from "../../../theme/motion";
import { SANDBOX_STEP_LABELS as L } from "../labels";
import { existingNoticeCopy } from "../model";

export interface ExistingNoticeProps {
  existing: ExistingSandbox;
  busy: boolean;
  onUse(): void;
}

export function ExistingNotice({ existing, busy, onUse }: ExistingNoticeProps) {
  const copy = existingNoticeCopy(existing);
  if (!copy) return null;
  return (
    <motion.div variants={rise} initial="initial" animate="animate">
      <Notice
        tone="info"
        title={L.existing.title}
        message={copy.message}
        actionLabel={copy.actionLabel && !busy ? copy.actionLabel : undefined}
        onAction={onUse}
      />
    </motion.div>
  );
}
