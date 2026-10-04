import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { Icon, IconWeight } from "phosphor-react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { ControlHeight, IconSize, type RadiusToken, type ThemeColor } from "@/theme";

import createStyles from "./styles";

export type IconTileProps = {
  icon: Icon;
  /** Tile edge length. Defaults to `ControlHeight.sm`. */
  size?: number;
  iconSize?: number;
  color?: ThemeColor;
  weight?: IconWeight;
  radius?: RadiusToken;
  style?: StyleProp<ViewStyle>;
};

/** Square dark tile with a hairline border holding a light, decorative icon. */
const IconTile = ({
  icon: IconComponent,
  size = ControlHeight.sm,
  iconSize = IconSize.sm,
  color = "text",
  weight = "light",
  radius = "sm",
  style,
}: IconTileProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, size, radius), [theme, size, radius]);

  return (
    <View style={[styles.tile, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <IconComponent size={iconSize} color={theme.colors[color]} weight={weight} />
    </View>
  );
};

export default IconTile;
