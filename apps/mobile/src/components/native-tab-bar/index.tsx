import { NativeTabs } from "expo-router/unstable-native-tabs";
import type { SFSymbol } from "expo-symbols";

import { useAppTheme } from "@/hooks/use-app-theme";
import { NativeTabBarContext } from "@/hooks/use-tab-bar-inset";

import { selectionHapticListeners } from "./listeners";

export type NativeTab = {
  name: string;
  label: string;
  symbol: { default: SFSymbol; selected: SFSymbol };
};

export type NativeTabBarProps = {
  tabs: readonly NativeTab[];
  /** Badge text per tab name; tabs without one show no badge. */
  badges?: Partial<Record<string, string | null>>;
};

/**
 * System tab navigator with the Liquid Glass bar (iOS 26+). Screens handle
 * their own insets: inside a tab the bar's height arrives through the safe area.
 */
const NativeTabBar = ({ tabs, badges }: NativeTabBarProps) => {
  const theme = useAppTheme();

  return (
    <NativeTabBarContext value>
      <NativeTabs minimizeBehavior="never" tintColor={theme.colors.text}>
        {tabs.map((tab) => {
          const badge = badges?.[tab.name];
          return (
            <NativeTabs.Trigger key={tab.name} name={tab.name} disableAutomaticContentInsets listeners={selectionHapticListeners}>
              <NativeTabs.Trigger.Icon sf={tab.symbol} />
              <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
              {badge ? <NativeTabs.Trigger.Badge>{badge}</NativeTabs.Trigger.Badge> : null}
            </NativeTabs.Trigger>
          );
        })}
      </NativeTabs>
    </NativeTabBarContext>
  );
};

export default NativeTabBar;
