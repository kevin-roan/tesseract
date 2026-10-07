import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { useOutlet } from "react-router";
import { cx } from "../../lib/cx";
import { PAGE_SWITCH_VARIANTS } from "./motion";
import { usePageKey } from "./use-page-key";
import styles from "./PageOutlet.module.css";

export interface PageOutletProps {
  className?: string;
}

export function PageOutlet({ className }: PageOutletProps) {
  const outlet = useOutlet();
  const pageKey = usePageKey();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return (
    <motion.div
      key={pageKey}
      className={cx(styles.page, className)}
      variants={PAGE_SWITCH_VARIANTS}
      initial={mounted.current ? "initial" : false}
      animate="animate"
      data-page-view={pageKey}
    >
      {outlet}
    </motion.div>
  );
}
