import { AnimatePresence, motion } from "motion/react";
import { Notice } from "../../../components/Notice";
import { reveal } from "../../../theme/motion";
import type { ConversationNotice } from "./model";
import styles from "./Conversation.module.css";

export interface ConversationNoticesProps {
  notices: readonly ConversationNotice[];
}

export function ConversationNotices({ notices }: ConversationNoticesProps) {
  return (
    <AnimatePresence initial={false}>
      {notices.length > 0 ? (
        <motion.div key="notices" className={styles.noticesReveal} variants={reveal} initial="initial" animate="animate" exit="exit">
          <div className={styles.notices}>
            <AnimatePresence initial={false}>
              {notices.map((notice) => (
                <motion.div key={notice.key} variants={reveal} initial="initial" animate="animate" exit="exit" className={styles.noticeItem}>
                  <Notice
                    message={notice.message}
                    title={notice.title}
                    tone={notice.tone}
                    icon={notice.icon}
                    actionLabel={notice.actionLabel}
                    onAction={notice.onAction}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
