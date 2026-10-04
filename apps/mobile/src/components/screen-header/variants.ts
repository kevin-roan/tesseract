import type { TextVariant } from "@/theme";

export type HeaderSize = "large" | "medium" | "regular";

export const HeaderTitleVariant: Record<HeaderSize, TextVariant> = {
  large: "h1",
  medium: "h2",
  regular: "h3",
};

export const HeaderSubtitleVariant: Record<HeaderSize, TextVariant> = {
  large: "bodySmall",
  medium: "caption",
  regular: "caption",
};

/** Action buttons shrink with the title so the row stays balanced. */
export const HeaderActionSize: Record<HeaderSize, "md" | "lg"> = {
  large: "lg",
  medium: "md",
  regular: "lg",
};
