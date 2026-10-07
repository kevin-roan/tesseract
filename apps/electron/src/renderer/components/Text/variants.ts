export const TEXT_VARIANTS = [
  "display",
  "title",
  "greeting",
  "h1",
  "h2",
  "h3",
  "h4",
  "metric",
  "metricSmall",
  "bodyLarge",
  "body",
  "bodyStrong",
  "bodySmall",
  "label",
  "button",
  "caption",
  "overline",
  "code",
] as const;

export type TextVariant = (typeof TEXT_VARIANTS)[number];
