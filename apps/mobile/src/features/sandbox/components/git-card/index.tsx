import { useMemo } from "react";
import { View } from "react-native";
import { GitBranchIcon } from "phosphor-react-native";
import type { GitDetails, GitSummary } from "@theone/protocol";

import MotionItem from "@/components/motion-item";
import ResourceCard from "@/components/resource-card";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors } from "@/lib/tone";
import { MaxFontSizeMultiplier } from "@/theme";

import { formatRelativeTime, pluralize, shortSha } from "../../utils/format";
import { gitBadge, gitFileCode, gitFileTone, gitSummaryLabel } from "../../utils/projects";
import createStyles from "./styles";

export type GitCardProps = {
  summary: GitSummary | null;
  details: GitDetails | undefined;
  fileLimit: number;
  commitLimit: number;
};

const GitCard = ({ summary, details, fileLimit, commitLimit }: GitCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const files = details?.files ?? [];
  const commits = details?.log.slice(0, commitLimit) ?? [];
  const hidden = Math.max(0, files.length - fileLimit);

  return (
    <ResourceCard
      icon={GitBranchIcon}
      title={summary?.branch ?? details?.branch ?? "No branch"}
      subtitle={gitSummaryLabel(summary)}
      badge={gitBadge(summary, files.length)}
    >
      {files.length > 0 ? (
        <View style={styles.tree}>
          {files.slice(0, fileLimit).map((file) => (
            <MotionItem key={file.path} style={styles.row}>
              <View style={styles.branch} />
              <ThemedText
                variant="code"
                color={ToneColors[gitFileTone(file)].foreground}
                numberOfLines={1}
                maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
                style={styles.code}
              >
                {gitFileCode(file)}
              </ThemedText>
              <ThemedText variant="code" color="textSecondary" numberOfLines={1} style={styles.grow}>
                {file.path}
              </ThemedText>
            </MotionItem>
          ))}
          {hidden > 0 ? (
            <View style={styles.row}>
              <View style={styles.branch} />
              <ThemedText variant="caption" color="textTertiary">
                {`+ ${pluralize(hidden, "more file")}`}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}
      {commits.length > 0 ? (
        <View style={styles.tree}>
          {commits.map((commit) => (
            <MotionItem key={commit.sha} style={styles.row}>
              <View style={styles.branch} />
              <ThemedText variant="code" color="textTertiary" style={styles.figure}>
                {shortSha(commit.sha)}
              </ThemedText>
              <ThemedText variant="bodySmall" numberOfLines={1} style={styles.grow}>
                {commit.subject}
              </ThemedText>
              <ThemedText variant="caption" color="textTertiary" numberOfLines={1} style={styles.figure}>
                {formatRelativeTime(commit.date)}
              </ThemedText>
            </MotionItem>
          ))}
        </View>
      ) : null}
    </ResourceCard>
  );
};

export default GitCard;
