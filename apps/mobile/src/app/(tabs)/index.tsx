import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowSquareOutIcon,
  ChartBarIcon,
  ChatCircleIcon,
  CopyIcon,
  FileTextIcon,
  FoldersIcon,
  ListChecksIcon,
  PlusIcon,
  StarIcon,
} from "phosphor-react-native";

import { ThemedView } from "@/components/themed-view";
import ActionRow, { type ActionItem } from "@/components/action-row";
import ListCard from "@/components/list-card";
import SectionHeader from "@/components/section-header";
import StatGrid, { type StatItem } from "@/components/stat-grid";
import { useAppTheme } from "@/hooks/use-app-theme";
import HomeHeader from "@/components/home-header";

const stats: StatItem[] = [
  {
    id: "conversations",
    icon: ChatCircleIcon,
    label: "Conversations",
    value: "24,891",
    unit: "/month",
    progress: 0.79,
  },
  {
    id: "projects",
    icon: FoldersIcon,
    label: "Active projects",
    value: "198",
    unit: "/month",
    progress: 0.52,
    featured: true,
  },
  {
    id: "completion",
    icon: ListChecksIcon,
    label: "Completion rate",
    value: "92%",
    unit: "/month",
    progress: 0.38,
  },
  {
    id: "rating",
    icon: StarIcon,
    label: "Average rating",
    value: "4.9",
    unit: "- 5.0 /month",
    progress: 0.14,
  },
];

const quickActions: ActionItem[] = [
  { id: "create", icon: PlusIcon, label: "Create", featured: true },
  { id: "templates", icon: CopyIcon, label: "Templates" },
  { id: "analytics", icon: ChartBarIcon, label: "Analytics" },
  { id: "share", icon: ArrowSquareOutIcon, label: "Share" },
];

type RecentForm = {
  id: string;
  title: string;
  responses: string;
};

const recentForms: RecentForm[] = [
  { id: "insights", title: "Customer Insights", responses: "2,079" },
  { id: "onboarding", title: "Onboarding Survey", responses: "1,244" },
  { id: "nps", title: "Quarterly NPS", responses: "863" },
];

export default function HomeScreen() {
  const theme = useAppTheme();

  return (
    <ThemedView style={styles.container}>
      <LinearGradient
        {...theme.gradients.dusk}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { gap: theme.sectionGap, padding: theme.gutter },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <HomeHeader />

          <StatGrid items={stats} />

          <View style={{ gap: theme.spacing.md }}>
            <SectionHeader title="Quick Actions" />
            <ActionRow items={quickActions} />
          </View>

          <View style={{ gap: theme.spacing.md }}>
            <SectionHeader
              title="Recent Forms"
              actionLabel="View All"
              onPressAction={() => {}}
            />
            {recentForms.map((form) => (
              <ListCard
                key={form.id}
                icon={FileTextIcon}
                title={form.title}
                value={form.responses}
                valueLabel="Responses"
              />
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
