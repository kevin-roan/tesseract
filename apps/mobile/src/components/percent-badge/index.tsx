import TagChip from "@/components/tag-chip";
import { percentLabel, progressPercent } from "@/lib/progress";

export type PercentBadgeProps = {
  /** Completion in the 0–1 range; values outside are clamped. */
  progress: number;
  testID?: string;
};

/** Hairline chip carrying a percentage, for the corner of a stat card. */
const PercentBadge = ({ progress, testID }: PercentBadgeProps) => (
  <TagChip
    label={percentLabel(progress)}
    accessibilityRole="progressbar"
    accessibilityValue={{ min: 0, max: 100, now: progressPercent(progress) }}
    testID={testID}
  />
);

export default PercentBadge;
