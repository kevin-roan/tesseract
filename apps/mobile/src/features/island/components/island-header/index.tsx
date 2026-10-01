import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { CaretUpIcon } from "phosphor-react-native";

import ConnectionDot from "@/components/connection-dot";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import type { Tone } from "@/lib/tone";
import { HitSlop, IconSize } from "@/theme";

import createStyles from "./styles";

export type IslandHeaderProps = {
  name: string;
  status: string;
  tone: Tone;
  onCollapse: () => void;
};

const IslandHeader = ({ name, status, tone, onCollapse }: IslandHeaderProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const collapse = useHapticPress(onCollapse);

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <ThemedText variant="h4" numberOfLines={1}>
          {name}
        </ThemedText>
        <ConnectionDot tone={tone} label={status} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Collapse" hitSlop={HitSlop.md} onPress={collapse}>
        <CaretUpIcon size={IconSize.md} color={theme.colors.textSecondary} weight="bold" />
      </Pressable>
    </View>
  );
};

export default IslandHeader;
