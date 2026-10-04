import { useMemo } from "react";
import { View } from "react-native";
import type { Icon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AvatarSize, IconSize, type ThemeColor } from "@/theme";

import createStyles from "./styles";

export type ToolRowProps = {
  icon: Icon;
  iconColor: ThemeColor;
  tool: string | null;
  summary: string;
  lines: number;
  error?: boolean;
};

const ToolRow = ({ icon, iconColor, tool, summary, lines, error = false }: ToolRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.tool, error && styles.toolError]}>
      <IconTile icon={icon} color={iconColor} size={AvatarSize.sm} iconSize={IconSize.xs} radius="sm" />
      <View style={styles.body}>
        {tool ? (
          <ThemedText variant="label" numberOfLines={1}>
            {tool}
          </ThemedText>
        ) : null}
        <ThemedText variant="code" color="textSecondary" numberOfLines={lines} selectable>
          {summary}
        </ThemedText>
      </View>
    </View>
  );
};

export default ToolRow;
