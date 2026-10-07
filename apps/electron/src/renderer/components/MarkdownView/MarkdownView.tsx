import { useMemo } from "react";
import { cx } from "../../lib/cx";
import type { SemanticColor } from "../../theme/colors";
import type { TextVariant } from "../Text/variants";
import { MARKDOWN_LABELS } from "./labels";
import { MarkdownBlock } from "./MarkdownBlock";
import { blockSignature, parseBlocks } from "./parser";
import styles from "./MarkdownView.module.css";

export interface MarkdownViewProps {
  text?: string;
  variant?: TextVariant;
  color?: SemanticColor;
  selectable?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  className?: string;
}

export function MarkdownView({
  text = "",
  variant = "body",
  color = "text",
  selectable = true,
  copyLabel = MARKDOWN_LABELS.copy,
  copiedLabel = MARKDOWN_LABELS.copied,
  className,
}: MarkdownViewProps) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div className={cx(styles.markdown, className)}>
      {blocks.map((block, index) => (
        <MarkdownBlock
          key={`${index}:${block.kind}`}
          block={block}
          signature={blockSignature(block)}
          variant={variant}
          color={color}
          selectable={selectable}
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
        />
      ))}
    </div>
  );
}
