import { memo } from "react";
import { cssVar } from "../../theme/colors";
import { segmentStyle } from "./ansi";
import { LOG_KIND_COLORS, LOG_LINE_HEIGHT_PX } from "./constants";
import type { LogLine } from "./model";
import styles from "./LogView.module.css";

interface LogChunkProps {
  lines: readonly LogLine[];
}

function LogLineView({ line }: { line: LogLine }) {
  return (
    <div className={styles.line} data-kind={line.kind} style={{ color: cssVar(LOG_KIND_COLORS[line.kind]) }}>
      {line.segments
        ? line.segments.map((segment, index) => (
            <span key={index} style={segmentStyle(segment)}>
              {segment.text}
            </span>
          ))
        : line.text}
    </div>
  );
}

function LogChunkView({ lines }: LogChunkProps) {
  return (
    <div className={styles.chunk} style={{ containIntrinsicBlockSize: `auto ${lines.length * LOG_LINE_HEIGHT_PX}px` }}>
      {lines.map((line) => (
        <LogLineView key={line.id} line={line} />
      ))}
    </div>
  );
}

export const LogChunk = memo(
  LogChunkView,
  (previous, next) =>
    previous.lines.length === next.lines.length && previous.lines.every((line, index) => line === next.lines[index]),
);
