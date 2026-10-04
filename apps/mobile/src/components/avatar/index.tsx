import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";

import { ThemedText, type ThemedTextProps } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AvatarSize, Durations } from "@/theme";

import createStyles from "./styles";
import { initialsOf } from "./utils/initials";

export { initialsOf } from "./utils/initials";

export type AvatarProps = {
  name: string;
  /** Remote or local photo. Falls back to initials when absent. */
  photo?: string;
  size?: number;
  /** Type variant for the initials; pick one that fits the circle. */
  initialsVariant?: ThemedTextProps["variant"];
  style?: StyleProp<ViewStyle>;
};

/**
 * Round photo with an initials fallback. Decorative: the name it stands for is
 * * always announced by the surrounding row, so it is not its own a11y element.
 */
const Avatar = ({ name, photo, size = AvatarSize.md, initialsVariant = "caption", style }: AvatarProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  return (
    <View style={[styles.avatar, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {photo ? (
        <Image source={{ uri: photo }} style={styles.image} contentFit="cover" transition={Durations.normal} />
      ) : (
        <ThemedText variant={initialsVariant} color="textSecondary" maxFontSizeMultiplier={1}>
          {initialsOf(name)}
        </ThemedText>
      )}
    </View>
  );
};

export default Avatar;
