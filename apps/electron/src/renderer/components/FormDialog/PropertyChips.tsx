import type { ReactNode } from "react";
import { Text } from "../Text";
import styles from "./FormDialog.module.css";

export interface PropertyChipsProps {
  children: ReactNode;
  hints?: readonly string[];
}

export function PropertyChips({ children, hints = [] }: PropertyChipsProps) {
  return (
    <>
      <div className={styles.chips}>{children}</div>
      {hints.length > 0 ? (
        <div className={styles.hints}>
          {hints.map((hint) => (
            <Text key={hint} variant="caption" color="text-secondary" wrap lines={null}>
              {hint}
            </Text>
          ))}
        </div>
      ) : null}
    </>
  );
}
