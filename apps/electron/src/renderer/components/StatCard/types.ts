import type { IconName } from "../../theme/icons";
import type { SurfaceTone } from "../Surface";

export interface StatItem {
  id: string;
  icon: IconName;
  label: string;
  value: string;
  unit?: string | null;
  progress?: number | null;
  tone?: SurfaceTone;
  caption?: string | null;
  onActivate?: () => void;
}
