import type { ThemeColor } from "@/theme";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export type ToneColor = { foreground: ThemeColor; background: ThemeColor };

export const ToneColors: Record<Tone, ToneColor> = {
  neutral: { foreground: "textSecondary", background: "backgroundElement" },
  info: { foreground: "info", background: "infoMuted" },
  success: { foreground: "success", background: "successMuted" },
  warning: { foreground: "warning", background: "warningMuted" },
  danger: { foreground: "danger", background: "dangerMuted" },
};
