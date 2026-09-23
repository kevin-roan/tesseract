import { useMemo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";

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

/** First letter of the first two words — "Ada Lovelace" becomes "AL". */
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

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
          <View style={styles.avatar}>
            {person.photo ? (
              <Image
                source={{ uri: person.photo }}
                style={styles.image}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <ThemedText variant="caption" color="textSecondary">
                {initialsOf(person.name)}
              </ThemedText>
            )}
          </View>
        </View>
      ))}

      {overflow > 0 ? (
        <View style={styles.slot}>
          <View style={[styles.avatar, styles.overflowBadge]}>
            <ThemedText variant="caption" color="textSecondary">
              +{overflow}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default AvatarStack;
