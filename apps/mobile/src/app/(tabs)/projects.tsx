import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import ProjectCard, { type ProjectCardProps } from "@/components/project-card";
import SectionHeader from "@/components/section-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";

type Project = ProjectCardProps & { id: string };

const projects: Project[] = [
  {
    id: "onboarding-revamp",
    title: "Details about project.",
    status: "ongoing",
    priority: "high",
    timeline: "06.09 - 12.10",
    people: [
      { id: "ada", name: "Ada Lovelace" },
      { id: "grace", name: "Grace Hopper" },
      { id: "alan", name: "Alan Turing" },
    ],
  },
  {
    id: "customer-insights",
    title: "Customer Insights survey",
    status: "ongoing",
    priority: "medium",
    timeline: "01.09 - 30.09",
    people: [
      { id: "katherine", name: "Katherine Johnson" },
      { id: "margaret", name: "Margaret Hamilton" },
      { id: "radia", name: "Radia Perlman" },
      { id: "barbara", name: "Barbara Liskov" },
    ],
  },
  {
    id: "quarterly-nps",
    title: "Quarterly NPS rollout",
    status: "paused",
    priority: "low",
    timeline: "15.08 - 20.11",
    people: [
      { id: "hedy", name: "Hedy Lamarr" },
      { id: "jean", name: "Jean Bartik" },
    ],
  },
  {
    id: "brand-refresh",
    title: "Brand refresh handoff",
    status: "completed",
    priority: "medium",
    timeline: "02.07 - 28.08",
    people: [
      { id: "shafi", name: "Shafi Goldwasser" },
      { id: "frances", name: "Frances Allen" },
      { id: "carol", name: "Carol Shaw" },
      { id: "sophie", name: "Sophie Wilson" },
      { id: "anita", name: "Anita Borg" },
    ],
  },
];

export default function ProjectsScreen() {
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
          <ThemedText variant="h1">Projects</ThemedText>

          <View style={{ gap: theme.spacing.md }}>
            <SectionHeader
              title="All Projects"
              actionLabel="View All"
              onPressAction={() => {}}
            />
            {projects.map(({ id, ...project }) => (
              <ProjectCard
                key={id}
                {...project}
                onPress={() => {}}
                onPressMenu={() => {}}
                onPressChat={() => {}}
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
