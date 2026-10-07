import { chartColorToken } from "../TimeSeriesChart/constants";
import { LINE_KEY } from "./constants";

export interface LineKeyProps {
  color: number;
  dash?: readonly number[];
  className?: string;
}

export function LineKey({ color, dash, className }: LineKeyProps) {
  const y = LINE_KEY.height / 2;
  return (
    <svg className={className} width={LINE_KEY.width} height={LINE_KEY.height} viewBox={`0 0 ${LINE_KEY.width} ${LINE_KEY.height}`} aria-hidden>
      <line
        x1={LINE_KEY.stroke}
        x2={LINE_KEY.width - LINE_KEY.stroke}
        y1={y}
        y2={y}
        stroke={`var(--to-${chartColorToken(color)})`}
        strokeWidth={LINE_KEY.stroke}
        strokeLinecap="round"
        strokeDasharray={dash && dash.length ? dash.join(" ") : undefined}
      />
    </svg>
  );
}
