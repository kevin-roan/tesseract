import type { ReactNode } from "react";

import styles from "./ui-card.module.css";

type UiCardProps = { title: ReactNode; meta?: ReactNode; children: ReactNode; className?: string };

export default function UiCard({ title, meta, children, className }: UiCardProps) {
  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      <div className={styles.head}>
        <span className={styles.dots}>
          <i />
          <i />
          <i />
        </span>
        <span className={styles.title}>{title}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
