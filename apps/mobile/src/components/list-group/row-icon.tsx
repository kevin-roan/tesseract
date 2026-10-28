import type { Icon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize, type ThemeColor } from "@/theme";

import { rowIconTileSize } from "./styles";

export type RowIconProps = {
  icon: Icon;
  color?: ThemeColor;
};

const RowIcon = ({ icon: IconComponent, color = "text" }: RowIconProps) => {
  const theme = useAppTheme();
  return theme.look === "graphite" ? (
    <IconTile icon={IconComponent} size={rowIconTileSize} iconSize={IconSize.md} color={color} radius="md" />
  ) : (
    <IconComponent size={IconSize.lg} color={theme.colors[color]} weight="regular" />
  );
};

export default RowIcon;
