import type { ReactNode } from "react";

import styles from "./panel.module.css";

export default function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      <div className={styles.grid} />
      {children}
    </div>
  );
}
