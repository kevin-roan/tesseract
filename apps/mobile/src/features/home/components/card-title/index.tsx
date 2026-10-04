import { useMemo } from "react";
import { View } from "react-native";
import type { Icon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ControlHeight, IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type CardTitleProps = {
  icon: Icon;
  title: string;
  trailing?: React.ReactNode;
};

/** Rounded icon tile, a light display heading, and an optional control pinned to the right. */
const CardTitle = ({ icon, title, trailing }: CardTitleProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <IconTile icon={icon} size={ControlHeight.md} iconSize={IconSize.md} radius="md" />
      <ThemedText
        variant="h4"
        numberOfLines={1}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
        style={styles.title}
        accessibilityRole="header"
      >
        {title}
      </ThemedText>
      {trailing}
    </View>
  );
};

export default CardTitle;
