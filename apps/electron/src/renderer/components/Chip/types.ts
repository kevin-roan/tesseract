import type { IconName } from "../../theme/icons";

export type ChipSize = "default" | "property" | "filter" | "suggestion";
export type ChipKind = "radio" | "toggle" | "switch" | "button";
export type ChipGroupSpacing = "default" | "compact";

export interface ChipOption<T extends string = string> {
  id: T;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  tooltip?: string;
}
