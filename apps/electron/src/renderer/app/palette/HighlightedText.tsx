import { useMemo } from "react";
import { highlightSegments } from "./model";
import type { MatchRange } from "./types";
import styles from "./CommandPalette.module.css";

export interface HighlightedTextProps {
  text: string;
  ranges: readonly MatchRange[];
}

export function HighlightedText({ text, ranges }: HighlightedTextProps) {
  const segments = useMemo(() => highlightSegments(text, ranges), [text, ranges]);
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index} className={styles.match}>
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
