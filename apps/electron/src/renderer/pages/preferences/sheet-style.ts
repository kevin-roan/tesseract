import type { CSSProperties } from "react";
import { PREFERENCES_SHEET } from "./constants";

export const SHEET_STYLE: CSSProperties = {
  width: `min(${PREFERENCES_SHEET.width}px, calc(100vw - ${PREFERENCES_SHEET.viewportMargin}px))`,
  height: `min(${PREFERENCES_SHEET.height}px, calc(100vh - ${PREFERENCES_SHEET.viewportMargin}px))`,
};
