import { BYTE_UNITS, DECIMAL_BYTE_BASE } from "./constants";

export function formatBytes(bytes: number, base: number = DECIMAL_BYTE_BASE): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= base && unit < BYTE_UNITS.length - 1) {
    value /= base;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
}
