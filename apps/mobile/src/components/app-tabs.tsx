import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StyleSheet, View } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

export default function AppTabs() {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      <NativeTabs
        backgroundColor={colors.background}
        indicatorColor={colors.backgroundElement}
        iconColor={{ default: colors.textSecondary, selected: colors.text }}
        tintColor={colors.text}
        labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.text } }}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="agents">
          <NativeTabs.Trigger.Label>Agents</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="tasks">
          <NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="checklist" md="checklist" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="projects">
          <NativeTabs.Trigger.Label>Projects</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "folder", selected: "folder.fill" }} md="folder" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="account_circle" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
