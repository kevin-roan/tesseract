import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import ActivityItem, { type ActivityItemProps } from "@/components/activity-item";
import ProfileHero, { type ProfileStat } from "@/components/profile-hero";
import SectionHeader from "@/components/section-header";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";

const user = {
  name: "Louis Saville",
  tagline: "Product lead, shipping in small slices",
  team: "Core Platform",
};

const stats: ProfileStat[] = [
  { id: "projects", value: "24", label: "Projects" },
  { id: "issues", value: "1 420", label: "Issues closed" },
  { id: "cycles", value: "38", label: "Cycles" },
];

type Activity = ActivityItemProps & { id: string };

const activity: Activity[] = [
  {
    id: "created-project",
    actor: user.name,
    action: "created project",
    target: "Mobile revamp",
    timeAgo: "6h ago",
    metrics: [
      { id: "issues", value: "18", label: "Issues" },
      { id: "members", value: "4", label: "Members" },
      { id: "due", value: "12.10", label: "Target" },
    ],
  },
  {
    id: "completed-cycle",
    actor: user.name,
    action: "completed cycle",
    target: "Cycle 38",
    timeAgo: "12h ago",
    metrics: [
      { id: "done", value: "31", label: "Completed" },
      { id: "carried", value: "5", label: "Carried" },
      { id: "scope", value: "92%", label: "Scope hit" },
    ],
  },
  {
    id: "closed-issue",
    actor: user.name,
    action: "closed issue",
    target: "Auth token refresh loop",
    timeAgo: "1d ago",
  },
  {
    id: "commented",
    actor: user.name,
    action: "commented on",
    target: "Design tokens RFC",
    timeAgo: "2d ago",
  },
  {
    id: "assigned",
    actor: user.name,
    action: "was assigned",
    target: "Offline sync spike",
    timeAgo: "3d ago",
  },
];

export default function ProfileScreen() {
  const theme = useAppTheme();

  return (
    <ThemedView style={styles.container}>
      <LinearGradient {...theme.gradients.dusk} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { gap: theme.sectionGap, padding: theme.gutter },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ProfileHero
            name={user.name}
            tagline={user.tagline}
            team={user.team}
            stats={stats}
            onPressMenu={() => {}}
          />

          <View style={{ gap: theme.spacing.md }}>
            <SectionHeader title="Activity" />
            {activity.map(({ id, ...item }) => (
              <ActivityItem key={id} {...item} onPress={() => {}} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});
