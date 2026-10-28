import { useEffect, useMemo, useState } from "react";
import type { GestureResponderEvent, LayoutChangeEvent, LayoutRectangle } from "react-native";
import type { TabTriggerSlotProps } from "expo-router/ui";
import type { Icon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/use-app-theme";
import { playHaptic } from "@/lib/haptics";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type TabButtonProps = Omit<TabTriggerSlotProps, "children"> & {
  icon: Icon;
  /** Read by screen readers; the bar itself is icon-only. */
  label: string;
  onFocusedLayout: (layout: LayoutRectangle) => void;
};

const TabButton = ({ icon: TabIcon, label, isFocused, onFocusedLayout, onPress, ...props }: TabButtonProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, 0), [theme]);
  const [layout, setLayout] = useState<LayoutRectangle>();

  useEffect(() => {
    if (isFocused && layout) onFocusedLayout(layout);
  }, [isFocused, layout, onFocusedLayout]);

  const handlePress = (event: GestureResponderEvent) => {
    if (!isFocused) playHaptic("selection");
    onPress?.(event);
  };

  return (
    <PressableScale
      depth="control"
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      {...props}
      onPress={handlePress}
      onLayout={(event: LayoutChangeEvent) => setLayout(event.nativeEvent.layout)}
      style={styles.button}
    >
      <TabIcon
        color={isFocused ? theme.colors.text : theme.colors.textSecondary}
        size={IconSize.md}
        weight={isFocused ? "fill" : "regular"}
      />
    </PressableScale>
  );
};

export default TabButton;
