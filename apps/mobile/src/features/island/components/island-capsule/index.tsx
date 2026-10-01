import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { CaretDownIcon } from "phosphor-react-native";

import DotSphere from "@/components/dot-sphere";
import { Glass } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { IconSize } from "@/theme";

import createStyles, { SPHERE } from "./styles";

export type IslandCapsuleProps = {
  title: string;
  badge: string | null;
  onPress: () => void;
  testID?: string;
};

const IslandCapsule = ({ title, badge, onPress, testID }: IslandCapsuleProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const press = useHapticPress(onPress);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${title}, ${badge}` : title}
      accessibilityHint="Shows running work and controls"
      onPress={press}
      testID={testID}
    >
      {({ pressed }) => (
        <Glass intensity="medium" style={[styles.capsule, pressed && styles.pressed]}>
          <DotSphere size={SPHERE.size} dots={SPHERE.dots} />
          <ThemedText variant="h4" numberOfLines={1} style={styles.title}>
            {title}
          </ThemedText>
          {badge ? (
            <View style={styles.pill}>
              <ThemedText variant="label">{badge}</ThemedText>
            </View>
          ) : null}
          <CaretDownIcon size={IconSize.sm} color={theme.colors.textSecondary} weight="bold" />
        </Glass>
      )}
    </Pressable>
  );
};

export default IslandCapsule;
