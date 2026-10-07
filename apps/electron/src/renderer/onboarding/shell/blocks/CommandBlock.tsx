import { CopyButton } from "../../../components/CopyButton";
import { SHELL_LABELS } from "../labels";
import styles from "./blocks.module.css";

export interface CommandBlockProps {
  command: string;
}

export function CommandBlock({ command }: CommandBlockProps) {
  return (
    <div className={styles.command}>
      <code className={styles.commandText} title={command}>
        {command}
      </code>
      <CopyButton text={command} copyLabel={SHELL_LABELS.copy} copiedLabel={SHELL_LABELS.copied} />
    </div>
  );
}
