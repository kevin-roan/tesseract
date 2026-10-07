import type { ReactNode } from "react";
import styles from "./PreferencesPage.module.css";

export function PreferencesPage({ children }: { children: ReactNode }) {
  return <div className={styles.page}>{children}</div>;
}
