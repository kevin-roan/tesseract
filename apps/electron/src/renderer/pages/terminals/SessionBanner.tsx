import { AnimatePresence, motion } from "motion/react";
import { Notice } from "../../components/Notice";
import { ACTION_LABELS } from "../../features/terminals/labels";
import { BANNER_VARIANTS } from "../../features/terminals/motion";
import type { BannerAction, BannerModel } from "../../features/terminals/types";
import styles from "./TerminalStage.module.css";

export interface SessionBannerProps {
  banner: BannerModel | null;
  bannerKey: string;
  onAction(action: BannerAction): void;
}

export function SessionBanner({ banner, bannerKey, onAction }: SessionBannerProps) {
  return (
    <AnimatePresence>
      {banner ? (
        <motion.div key={bannerKey} className={styles.banner} variants={BANNER_VARIANTS} initial="initial" animate="animate" exit="exit">
          <Notice
            floating
            className={styles.notice}
            title={banner.title}
            message={banner.message}
            tone={banner.tone}
            actionLabel={banner.action ? ACTION_LABELS[banner.action] : undefined}
            onAction={banner.action ? () => onAction(banner.action as BannerAction) : undefined}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
