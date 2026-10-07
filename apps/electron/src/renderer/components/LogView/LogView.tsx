import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { useScheme } from "../../app/scheme";
import { cx } from "../../lib/cx";
import { ansiPaletteVars } from "./ansi";
import { LOG_CHUNK_LINES, LOG_DEFAULT_MIN_HEIGHT, LOG_FOLLOW_THRESHOLD_PX } from "./constants";
import { OverlayScrollbar } from "../OverlayScrollbar";
import { JumpButton } from "./JumpButton";
import { LOG_LABELS } from "./labels";
import { LogChunk } from "./LogChunk";
import { chunkLines, type LogLine } from "./model";
import { useFollowTail } from "./use-follow-tail";
import styles from "./LogView.module.css";

export interface LogViewHandle {
  jumpToEnd(): void;
}

export interface LogViewProps {
  lines: readonly LogLine[];
  emptyLabel?: string;
  jumpLabel?: string;
  minHeight?: number;
  className?: string;
  ref?: Ref<LogViewHandle>;
}

export function LogView({
  lines,
  emptyLabel = LOG_LABELS.empty,
  jumpLabel = LOG_LABELS.jump,
  minHeight = LOG_DEFAULT_MIN_HEIGHT,
  className,
  ref,
}: LogViewProps) {
  const scheme = useScheme();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const chunks = useMemo(() => chunkLines(lines, LOG_CHUNK_LINES), [lines]);
  const palette = useMemo(() => ansiPaletteVars(scheme), [scheme]);
  const { detached, jumpToEnd } = useFollowTail({
    threshold: LOG_FOLLOW_THRESHOLD_PX,
    scrollerRef,
    contentRef,
    changeKey: lines,
  });
  useImperativeHandle(ref, () => ({ jumpToEnd }), [jumpToEnd]);
  const empty = lines.length === 0;

  return (
    <div className={cx(styles.view, className)} style={palette}>
      <div ref={scrollerRef} className={styles.scroller} style={{ minHeight }} data-log-scroller="">
        <div ref={contentRef} className={styles.content} role="log" aria-live="off">
          {chunks.map((chunk) => (
            <LogChunk key={Math.floor((chunk[0]?.id ?? 0) / LOG_CHUNK_LINES)} lines={chunk} />
          ))}
        </div>
      </div>
      <OverlayScrollbar target={scrollerRef} />
      {empty ? <span className={styles.empty}>{emptyLabel}</span> : null}
      <JumpButton visible={detached && !empty} label={jumpLabel} onClick={jumpToEnd} />
    </div>
  );
}
