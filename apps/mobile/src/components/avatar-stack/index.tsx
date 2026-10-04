import { useMemo } from "react";
import { View } from "react-native";

import Avatar from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AvatarSize } from "@/theme";

import createStyles from "./styles";

export type AvatarPerson = {
  id: string;
  name: string;
  /** Remote or local photo. Falls back to initials when absent. */
  photo?: string;
};

export type AvatarStackProps = {
  people: AvatarPerson[];
  /** How many faces to show before collapsing the rest into a "+n" chip. */
  max?: number;
  size?: number;
};

/**
 * Overlapping row of member avatars. Anything past `max` collapses into a
 * trailing "+n" chip so the stack keeps a predictable width.
 */
const AvatarStack = ({ people, max = 3, size = AvatarSize.sm }: AvatarStackProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <View
      style={styles.stack}
      accessibilityRole="image"
      accessibilityLabel={people.map((person) => person.name).join(", ")}
    >
      {shown.map((person, index) => (
        <View
          key={person.id}
          style={[styles.slot, index === 0 && styles.firstSlot]}
        >
          <Avatar name={person.name} photo={person.photo} size={size} style={styles.ring} />
        </View>
      ))}

      {overflow > 0 ? (
        <View style={styles.slot}>
          <View style={[styles.avatar, styles.ring, styles.overflowBadge]}>
            <ThemedText variant="caption" color="textSecondary" maxFontSizeMultiplier={1} style={styles.count}>
              +{overflow}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default AvatarStack;
