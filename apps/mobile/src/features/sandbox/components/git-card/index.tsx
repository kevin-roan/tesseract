import { useMemo } from "react";
import { View } from "react-native";
import { GitBranchIcon } from "phosphor-react-native";
import type { GitDetails, GitSummary } from "@theone/protocol";

import KeyValueRow from "@/components/key-value-row";
import ResourceCard from "@/components/resource-card";
import StatusBadge from "@/components/status-badge";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

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
        <View style={styles.list}>
          {files.slice(0, fileLimit).map((file) => (
            <View key={file.path} style={styles.fileRow}>
              <StatusBadge label={gitFileCode(file)} tone={gitFileTone(file)} />
              <ThemedText variant="code" color="textSecondary" numberOfLines={1} style={styles.path}>
                {file.path}
              </ThemedText>
            </View>
          ))}
          {hidden > 0 ? (
            <ThemedText variant="caption" color="textTertiary">
              {`+ ${pluralize(hidden, "more file")}`}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      {commits.length > 0 ? (
        <View style={styles.list}>
          {commits.map((commit) => (
            <KeyValueRow
              key={commit.sha}
              label={`${shortSha(commit.sha)} · ${formatRelativeTime(commit.date)}`}
              value={commit.subject}
            />
          ))}
        </View>
      ) : null}
    </ResourceCard>
  );
};

export default GitCard;
