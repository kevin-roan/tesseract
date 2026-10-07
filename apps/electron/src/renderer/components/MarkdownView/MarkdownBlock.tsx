import { memo, useMemo } from "react";
import { cx } from "../../lib/cx";
import { cssVar, type SemanticColor } from "../../theme/colors";
import typography from "../../theme/typography.module.css";
import { CodeBlock } from "../CodeBlock";
import type { TextVariant } from "../Text/variants";
import { HEADING_FALLBACK_VARIANT, HEADING_VARIANTS, LIST_INDENT_PX, TABLE_HEADER_VARIANT, TASK_MARKERS } from "./constants";
import { Inline } from "./Inline";
import { parseInline, type Block, type ListItem } from "./parser";
import styles from "./MarkdownView.module.css";

export interface MarkdownBlockProps {
  block: Block;
  signature: string;
  variant: TextVariant;
  color: SemanticColor;
  selectable: boolean;
  copyLabel: string;
  copiedLabel: string;
}

interface RichTextProps {
  text: string;
  variant: TextVariant;
  color?: SemanticColor;
  selectable: boolean;
  className?: string;
}

function RichText({ text, variant, color, selectable, className }: RichTextProps) {
  const nodes = useMemo(() => parseInline(text), [text]);
  return (
    <div
      className={cx(styles.label, typography[variant], selectable && styles.selectable, className)}
      style={color ? { color: cssVar(color) } : undefined}
    >
      <Inline nodes={nodes} />
    </div>
  );
}

function markerFor(item: ListItem): string {
  if (item.checked === null) return item.marker;
  return item.checked ? TASK_MARKERS.checked : TASK_MARKERS.unchecked;
}

function MarkdownBlockView({ block, variant, color, selectable, copyLabel, copiedLabel }: MarkdownBlockProps) {
  switch (block.kind) {
    case "heading":
      return (
        <RichText
          text={block.text}
          variant={HEADING_VARIANTS[block.level] ?? HEADING_FALLBACK_VARIANT}
          color="text"
          selectable={selectable}
        />
      );
    case "paragraph":
      return <RichText text={block.text} variant={variant} color={color} selectable={selectable} />;
    case "code":
      return <CodeBlock code={block.text} language={block.language} copyLabel={copyLabel} copiedLabel={copiedLabel} />;
    case "quote":
      return (
        <div className={styles.quote}>
          <RichText text={block.text} variant={variant} color="text-secondary" selectable={selectable} />
        </div>
      );
    case "rule":
      return <div className={styles.rule} role="separator" />;
    case "list":
      return (
        <div className={styles.list}>
          {block.items.map((item, index) => (
            <div key={index} className={styles.listRow} style={{ marginLeft: item.depth * LIST_INDENT_PX }}>
              <span className={cx(styles.marker, typography[variant])}>{markerFor(item)}</span>
              <RichText text={item.text} variant={variant} color={color} selectable={selectable} className={styles.itemText} />
            </div>
          ))}
        </div>
      );
    case "table":
      return <MarkdownTable rows={block.rows} variant={variant} color={color} selectable={selectable} />;
  }
}

interface MarkdownTableProps {
  rows: string[][];
  variant: TextVariant;
  color: SemanticColor;
  selectable: boolean;
}

function MarkdownTable({ rows, variant, color, selectable }: MarkdownTableProps) {
  const columns = Math.max(1, ...rows.map((row) => row.length));
  return (
    <div className={styles.tableScroller}>
      <div className={styles.table} style={{ gridTemplateColumns: `repeat(${columns}, max-content)` }}>
        {rows.map((row, rowIndex) =>
          row.map((cell, cellIndex) => (
            <RichText
              key={`${rowIndex}:${cellIndex}`}
              text={cell}
              variant={rowIndex === 0 ? TABLE_HEADER_VARIANT : variant}
              color={color}
              selectable={selectable}
              className={styles.cell}
            />
          )).concat(
            Array.from({ length: columns - row.length }, (_, pad) => <span key={`${rowIndex}:pad${pad}`} />),
          ),
        )}
      </div>
    </div>
  );
}

export const MarkdownBlock = memo(
  MarkdownBlockView,
  (previous, next) =>
    previous.signature === next.signature &&
    previous.variant === next.variant &&
    previous.color === next.color &&
    previous.selectable === next.selectable &&
    previous.copyLabel === next.copyLabel &&
    previous.copiedLabel === next.copiedLabel,
);
