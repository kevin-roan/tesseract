import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFooterTarget } from "./footer-context";
import styles from "./OnboardingFooter.module.css";

export interface OnboardingFooterProps {
  start?: ReactNode;
  end?: ReactNode;
}

export function OnboardingFooter({ start, end }: OnboardingFooterProps) {
  const target = useFooterTarget();
  if (!target) return null;
  return createPortal(
    <>
      <div className={styles.group}>{start}</div>
      <div className={styles.group}>{end}</div>
    </>,
    target,
  );
}
