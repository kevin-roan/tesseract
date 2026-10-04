import { useMemo } from "react";
import Animated from "react-native-reanimated";
import type { Icon } from "phosphor-react-native";

import TagChip from "@/components/tag-chip";
import { useLayoutMotion } from "@/hooks/use-layout-motion";
import type { Tone } from "@/lib/tone";

import createStyles from "./styles";

export type StatusBadgeProps = {
  label: string;
  tone?: Tone;
  icon?: Icon;
};

/**
 * Tinted status chip: a tone dot (or icon) and the label in the tone color,
 * announced as one element. A new label or tone cross-fades in over the old.
 */
const StatusBadge = ({ label, tone = "neutral", icon }: StatusBadgeProps) => {
  const styles = useMemo(() => createStyles(), []);
  const motion = useLayoutMotion();

  return (
    <Animated.View
      key={`${tone}:${label}`}
      entering={motion.fadeIn}
      exiting={motion.fadeOut}
      style={styles.badge}
    >
      <TagChip label={label} tone={tone} icon={icon} dot={!icon} tinted accessibilityLabel={label} />
    </Animated.View>
  );
};

export default StatusBadge;
