import type { ReactNode } from "react";
import { Text } from "../Text";
import styles from "./Timeline.module.css";

export interface AuthorLineProps {
  avatar: ReactNode;
  name: string;
  time?: string;
}

export function AuthorLine({ avatar, name, time }: AuthorLineProps) {
  return (
    <div className={styles.authorLine}>
      {avatar}
      <Text variant="label">{name}</Text>
      {time ? (
        <Text variant="caption" color="text-tertiary">
          {time}
        </Text>
      ) : null}
    </div>
  );
}
