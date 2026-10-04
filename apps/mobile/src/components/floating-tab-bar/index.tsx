import { useMemo, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Href } from "expo-router";
import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui";
import type { Icon } from "phosphor-react-native";

import { Glass } from "@/components/glass";
import { useAppTheme } from "@/hooks/use-app-theme";
import { TabBarInsetContext } from "@/hooks/use-tab-bar-inset";
import { useTabIndicator } from "@/hooks/use-tab-indicator";

import createStyles from "./styles";
import TabButton from "./tab-button";

export type FloatingTab = {
  name: string;
  href: Href;
  label: string;
  icon: Icon;
};

export type FloatingTabBarProps = {
  tabs: readonly FloatingTab[];
};

/**
 * Tab navigator with a floating glass pill docked above the home indicator.
 * Screens scroll underneath it; `useTabBarInset` tells them how much room to leave.
 */
const FloatingTabBar = ({ tabs }: FloatingTabBarProps) => {
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
          <View style={styles.float} onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}>
            <Glass intensity="heavy" style={styles.glass}>
              <Animated.View style={[styles.indicator, indicator.style]} pointerEvents="none" />
              <View style={styles.bar} accessibilityRole="tablist">
                {tabs.map((tab) => (
                  <TabTrigger key={tab.name} name={tab.name} asChild>
                    <TabButton icon={tab.icon} onFocusedLayout={indicator.moveTo}>
                      {tab.label}
                    </TabButton>
                  </TabTrigger>
                ))}
              </View>
            </Glass>
          </View>
        </View>
      </Tabs>
    </TabBarInsetContext>
  );
};

export default FloatingTabBar;
