import { create } from "qrcode";
import { QR_ERROR_CORRECTION } from "./constants";

export interface QrMatrix {
  size: number;
  path: string;
}

export function qrMatrix(text: string): QrMatrix {
  const { modules } = create(text, { errorCorrectionLevel: QR_ERROR_CORRECTION });
  const size = modules.size;
  const parts: string[] = [];
  for (let row = 0; row < size; row += 1) {
    let column = 0;
    while (column < size) {
      if (!modules.get(row, column)) {
        column += 1;
        continue;
      }
      const start = column;
      while (column < size && modules.get(row, column)) column += 1;
      parts.push(`M${start} ${row}h${column - start}v1h${start - column}z`);
    }
  }
  return { size, path: parts.join("") };
}
