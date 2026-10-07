import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";

export interface RowAction {
  id: string;
  icon: IconName;
  label: string;
  onActivate: () => void;
  sensitive?: boolean;
  destructive?: boolean;
  active?: boolean;
  labeled?: boolean;
}

export interface RecordStatus {
  label: string;
  tone?: Tone;
  glyph?: boolean;
  live?: boolean;
}
