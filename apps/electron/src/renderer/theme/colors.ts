export const SEMANTIC_COLORS = [
  "background",
  "background-element",
  "background-selected",
  "surface",
  "surface-elevated",
  "surface-sunken",
  "overlay",
  "text",
  "text-secondary",
  "text-tertiary",
  "text-inverse",
  "text-on-accent",
  "border",
  "border-strong",
  "divider",
  "accent",
  "accent-ink",
  "accent-pressed",
  "accent-muted",
  "accent-strong",
  "focus-ring",
  "highlight",
  "brand",
  "badge",
  "badge-text",
  "success",
  "success-muted",
  "success-solid",
  "warning",
  "warning-muted",
  "warning-solid",
  "danger",
  "danger-muted",
  "danger-solid",
  "info",
  "info-muted",
  "info-solid",
  "notification",
  "code-background",
] as const;

export type SemanticColor = (typeof SEMANTIC_COLORS)[number];

export const cssVar = (color: SemanticColor): string => `var(--to-${color})`;

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const TONE_COLORS: Record<Tone, { fg: SemanticColor; bg: SemanticColor; solid: SemanticColor }> = {
  neutral: { fg: "text-secondary", bg: "background-element", solid: "text-tertiary" },
  info: { fg: "info", bg: "info-muted", solid: "info-solid" },
  success: { fg: "success", bg: "success-muted", solid: "success-solid" },
  warning: { fg: "warning", bg: "warning-muted", solid: "warning-solid" },
  danger: { fg: "danger", bg: "danger-muted", solid: "danger-solid" },
};
