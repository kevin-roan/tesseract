import type { ReactNode } from "react";
import styles from "./PreferenceRows.module.css";

export function SettingsActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
