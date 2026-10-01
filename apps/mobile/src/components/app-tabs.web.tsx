import { useMemo } from 'react';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import {
  FolderSimpleIcon,
  HouseIcon,
  ListChecksIcon,
  RobotIcon,
  UserCircleIcon,
  type Icon,
} from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { useAppTheme } from '@/hooks/use-app-theme';
import { IconSize, MaxFontSizeMultiplier, MinTouchTarget, type Theme } from '@/theme';

/**
 * Web tab bar. It sits in normal flow under the slot rather than floating
 * over it, so the last rows of a scrolling screen are never hidden behind it.
 */
export default function AppTabs() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <View style={styles.tabList}>
          <View style={styles.tabBar} accessibilityRole="tablist">
            <TabTrigger name="index" href="/" asChild>
              <TabButton icon={HouseIcon}>Home</TabButton>
            </TabTrigger>
            <TabTrigger name="agents" href="/agents" asChild>
              <TabButton icon={RobotIcon}>Agents</TabButton>
            </TabTrigger>
            <TabTrigger name="tasks" href="/tasks" asChild>
              <TabButton icon={ListChecksIcon}>Tasks</TabButton>
            </TabTrigger>
            <TabTrigger name="projects" href="/projects" asChild>
              <TabButton icon={FolderSimpleIcon}>Projects</TabButton>
            </TabTrigger>
            <TabTrigger name="profile" href="/profile" asChild>
              <TabButton icon={UserCircleIcon}>Profile</TabButton>
            </TabTrigger>
          </View>
        </View>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: Icon };

function TabButton({ children, icon: TabIcon, isFocused, ...props }: TabButtonProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      {...props}
      style={({ pressed }) => [styles.button, isFocused && styles.buttonFocused, pressed && styles.pressed]}
    >
      <TabIcon
        color={isFocused ? theme.colors.text : theme.colors.textSecondary}
        size={IconSize.md}
        weight={isFocused ? 'fill' : 'regular'}
      />
      <ThemedText
        variant="caption"
        color={isFocused ? 'text' : 'textSecondary'}
        numberOfLines={1}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
      >
        {children}
      </ThemedText>
    </Pressable>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    slot: {
      flex: 1,
    },
    tabList: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.base,
    },
    tabBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 1,
      gap: theme.spacing.xxs,
      padding: theme.spacing.xs,
      borderRadius: theme.radius.xl,
      maxWidth: theme.maxContentWidth,
      backgroundColor: theme.colors.backgroundElement,
    },
    /** Icon over label and an equal share each, so five tabs fit a 320dp phone. */
    button: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xxs,
      minHeight: MinTouchTarget,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.lg,
    },
    buttonFocused: {
      backgroundColor: theme.colors.backgroundSelected,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
