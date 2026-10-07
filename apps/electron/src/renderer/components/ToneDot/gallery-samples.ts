import type { Tone } from "../../theme/colors";
import type { ToneDotSize } from "./ToneDot";

export const TONES: Tone[] = ["neutral", "info", "success", "warning", "danger"];
export const DOT_SIZES: ToneDotSize[] = [8, 6];
export const DOT_LABELS = { live: "live", unread: "unread" } as const;
