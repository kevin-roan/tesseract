import { useMemo, type ReactNode } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { ArrowLeftIcon } from "phosphor-react-native";

import { Glass } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";
import ToolbarButton, { type GlassToolbarAction } from "./toolbar-button";

export type { GlassToolbarAction } from "./toolbar-button";

export type GlassToolbarProps = {
  title: string;
  subtitle?: string;
  /** Rendered next to the title, e.g. a connection dot. */
  accessory?: ReactNode;
  onBack?: () => void;
  actions?: GlassToolbarAction[];
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Compact floating pill for full-bleed screens: back, a two-line title and a
 * row of icon actions on one liquid-glass surface. Position it yourself.
 */
const GlassToolbar = ({ title, subtitle, accessory, onBack, actions, onLayout, style, testID }: GlassToolbarProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={style} onLayout={onLayout} testID={testID}>
      <Glass intensity="heavy" style={styles.bar}>
        {onBack ? <ToolbarButton id="back" icon={ArrowLeftIcon} label="Go back" onPress={onBack} /> : null}
        <View style={styles.titles}>
          <View style={styles.titleRow}>
            <ThemedText variant="label" numberOfLines={1} accessibilityRole="header" style={styles.title}>
              {title}
            </ThemedText>
            {accessory}
          </View>
          {subtitle ? (
            <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {actions?.map((action) => <ToolbarButton key={action.id} {...action} />)}
      </Glass>
    </View>
  );
};

export default GlassToolbar;
