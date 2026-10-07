import { motion } from "motion/react";
import { ActionButton } from "../../components/ActionButton";
import { Notice } from "../../components/Notice";
import { fade } from "../../theme/motion";
import { CommandBlock } from "../shell";
import { CLAUDE_LABELS } from "./labels";
import { noticeActionLabel, type ClaudeNotice, type ClaudeNoticeAction } from "./model";
import styles from "./ClaudeStep.module.css";

export interface ClaudeNoticeBlockProps {
  notice: ClaudeNotice | null;
  failed: string | null;
  onCheck(): void;
  onOpenGuide(): void;
}

export function ClaudeNoticeBlock({ notice, failed, onCheck, onOpenGuide }: ClaudeNoticeBlockProps) {
  const key = failed ? "failed" : notice ? `${notice.tone}:${notice.title ?? notice.message}` : "none";
  const run = (action: ClaudeNoticeAction) => (action === "install-guide" ? onOpenGuide : onCheck);
  return (
    <>
      {failed || notice ? (
        <motion.div key={key} className={styles.status} variants={fade} initial="initial" animate="animate">
          {failed ? (
            <Notice tone="danger" message={failed} actionLabel={CLAUDE_LABELS.checkAgain} onAction={onCheck} />
          ) : notice ? (
            <>
              <Notice
                tone={notice.tone}
                title={notice.title}
                message={notice.message}
                actionLabel={notice.action ? noticeActionLabel(notice.action) : undefined}
                onAction={notice.action ? run(notice.action) : undefined}
              />
              {notice.secondaryAction ? (
                <div className={styles.secondaryAction}>
                  <ActionButton variant="link" size="sm" label={noticeActionLabel(notice.secondaryAction)} onClick={run(notice.secondaryAction)} />
                </div>
              ) : null}
              {notice.command ? (
                <CommandBlock command={notice.command} />
              ) : null}
            </>
          ) : null}
        </motion.div>
      ) : null}
    </>
  );
}
