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
import { ThemedView } from './themed-view';

import { useAppTheme } from '@/hooks/use-app-theme';

export default function AppTabs() {
  const { spacing, radius, maxContentWidth } = useAppTheme();

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <View style={[styles.tabList, { padding: spacing.base }]}>
          <ThemedView
            background="backgroundElement"
            style={[
              styles.tabBar,
              {
                gap: spacing.sm,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.xl,
                borderRadius: radius.full,
                maxWidth: maxContentWidth,
              },
            ]}>
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
          </ThemedView>
        </View>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: Icon };

function TabButton({ children, icon: TabIcon, isFocused, ...props }: TabButtonProps) {
  const { spacing, radius, colors, text } = useAppTheme();

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        background={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[
          styles.button,
          {
            gap: spacing.xs,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.base,
            borderRadius: radius.md,
          },
        ]}>
        <TabIcon
          color={isFocused ? colors.text : colors.textSecondary}
          size={text.bodySmall.fontSize}
          weight={isFocused ? 'fill' : 'regular'}
        />
        <ThemedText variant="bodySmall" color={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: '100%',
  },
  tabList: {
    position: 'absolute',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
