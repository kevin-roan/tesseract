import { useMemo, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Href } from "expo-router";
import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui";
import type { Icon } from "phosphor-react-native";

import { Glass } from "@/components/glass";
import PressableScale from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/use-app-theme";
import { TabBarInsetContext } from "@/hooks/use-tab-bar-inset";
import { useTabIndicator } from "@/hooks/use-tab-indicator";
import { playHaptic } from "@/lib/haptics";
import { IconSize } from "@/theme";

import createStyles from "./styles";
import TabButton from "./tab-button";

export type FloatingTab = {
  name: string;
  href: Href;
  label: string;
  icon: Icon;
};

/** Round button docked beside the pill, like Linear's search shortcut. */
export type FloatingTabAccessory = {
  label: string;
  icon: Icon;
  onPress: () => void;
  /** Shows an unread dot. */
  badge?: boolean;
};

export type FloatingTabBarProps = {
  tabs: readonly FloatingTab[];
  accessory?: FloatingTabAccessory;
};

/**
 * Tab navigator with a compact, icon-only glass pill docked above the home
 * indicator, plus an optional round accessory beside it (Linear style).
 * Screens scroll underneath it; `useTabBarInset` tells them how much room to leave.
 */
const FloatingTabBar = ({ tabs, accessory }: FloatingTabBarProps) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom - theme.spacing.md, theme.spacing.sm);
  const styles = useMemo(() => createStyles(theme, bottom), [theme, bottom]);
  const indicator = useTabIndicator();
  const [barHeight, setBarHeight] = useState(0);
  const inset = barHeight + bottom - insets.bottom + theme.spacing.base;

  return (
    <TabBarInsetContext value={inset}>
      <Tabs style={styles.root}>
        <TabSlot style={styles.slot} />
        {/* `Tabs` only reads routes from direct TabList children, so they are declared here; the visible triggers below go by name. */}
        <TabList style={styles.routes}>
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} />
          ))}
        </TabList>
        <View style={styles.dock} pointerEvents="box-none">
          <View style={styles.row} onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}>
            <View style={styles.float}>
              <Glass intensity="heavy" style={styles.glass}>
                <Animated.View style={[styles.indicator, indicator.style]} pointerEvents="none" />
                <View style={styles.bar} accessibilityRole="tablist">
                  {tabs.map((tab) => (
                    <TabTrigger key={tab.name} name={tab.name} asChild>
                      <TabButton icon={tab.icon} label={tab.label} onFocusedLayout={indicator.moveTo} />
                    </TabTrigger>
                  ))}
                </View>
              </Glass>
            </View>
            {accessory ? <AccessoryButton {...accessory} styles={styles} /> : null}
          </View>
        </View>
      </Tabs>
    </TabBarInsetContext>
  );
};

const AccessoryButton = ({
  label,
  icon: AccessoryIcon,
  onPress,
  badge,
  styles,
}: FloatingTabAccessory & { styles: ReturnType<typeof createStyles> }) => {
  const theme = useAppTheme();

  return (
    <View style={styles.accessoryFloat}>
      <Glass intensity="heavy" interactive style={styles.accessoryGlass}>
        <PressableScale
          depth="control"
          accessibilityRole="button"
          accessibilityLabel={badge ? `${label}, unread` : label}
          onPress={() => {
            playHaptic("selection");
            onPress();
          }}
          style={styles.accessoryButton}
        >
          <AccessoryIcon color={theme.colors.text} size={IconSize.md} />
          {badge ? <View style={styles.badge} pointerEvents="none" /> : null}
        </PressableScale>
      </Glass>
    </View>
  );
};

export default FloatingTabBar;
