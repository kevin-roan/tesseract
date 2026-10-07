import { memo } from "react";
import { cx } from "../../lib/cx";
import { CopyButton } from "../CopyButton";
import styles from "./CodeBlock.module.css";

export interface CodeBlockProps {
  code: string;
  language?: string;
  copyLabel?: string;
  copiedLabel?: string;
  className?: string;
}

export const CodeBlock = memo(function CodeBlock({ code, language = "", copyLabel, copiedLabel, className }: CodeBlockProps) {
  return (
    <div className={cx(styles.block, className)}>
      <div className={styles.scroller}>
        <pre className={styles.body}>{code}</pre>
      </div>
      <div className={styles.actions}>
        {language ? <span className={styles.language}>{language}</span> : null}
        <CopyButton text={code} copyLabel={copyLabel} copiedLabel={copiedLabel} />
      </div>
    </div>
  );
});
