import type { ReactNode } from "react";
import styles from "./kit.module.css";

export interface TabStackProps {
  children: ReactNode;
}

export function TabStack({ children }: TabStackProps) {
  return <div className={styles.stack}>{children}</div>;
}
