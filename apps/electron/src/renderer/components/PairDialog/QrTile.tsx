import { useMemo } from "react";
import { QR_SIZE } from "./constants";
import { qrMatrix } from "./qr";
import styles from "./PairDialog.module.css";

export interface QrTileProps {
  value: string;
  size?: number;
  label?: string;
}

export function QrTile({ value, size = QR_SIZE, label }: QrTileProps) {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  return (
    <div className={styles.qr} data-testid="pair-qr">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${matrix.size} ${matrix.size}`}
        shapeRendering="crispEdges"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <path d={matrix.path} fill="#000000" />
      </svg>
    </div>
  );
}
