import { create } from "qrcode";
import { QR, QR_BLOCKS } from "./constants";

export function qrMatrix(text: string): boolean[][] {
  const { modules } = create(text, { errorCorrectionLevel: QR.errorCorrection });
  const size = modules.size + QR.quietZone * 2;
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => {
      const r = row - QR.quietZone;
      const c = column - QR.quietZone;
      return r >= 0 && c >= 0 && r < modules.size && c < modules.size && Boolean(modules.get(r, c));
    }),
  );
}

function block(top: boolean, bottom: boolean, darkIsInk: boolean): string {
  const topInk = darkIsInk ? top : !top;
  const bottomInk = darkIsInk ? bottom : !bottom;
  if (topInk && bottomInk) return QR_BLOCKS.both;
  if (topInk) return QR_BLOCKS.top;
  if (bottomInk) return QR_BLOCKS.bottom;
  return QR_BLOCKS.none;
}

export function renderQr(text: string, color: boolean): string[] {
  const matrix = qrMatrix(text);
  const lines: string[] = [];
  for (let row = 0; row < matrix.length; row += 2) {
    const top = matrix[row] ?? [];
    const bottom = matrix[row + 1] ?? top.map(() => false);
    const cells = top.map((dark, column) => block(dark, bottom[column] ?? false, color)).join("");
    lines.push(color ? `${QR.ansiDarkOnLight}${cells}${QR.ansiReset}` : cells);
  }
  return lines;
}
