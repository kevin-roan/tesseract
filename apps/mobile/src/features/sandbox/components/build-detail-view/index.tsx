import { useMemo } from "react";
import { View } from "react-native";
import { HammerIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import LogView from "@/components/log-view";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import ProgressBar from "@/components/progress-bar";
import Reveal from "@/components/reveal";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import StatusBadge from "@/components/status-badge";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useBuildDetail } from "../../hooks/use-build-detail";
import ArtifactCard from "../artifact-card";
import createStyles from "./styles";

export type BuildDetailViewProps = {
  buildId: string;
};

const BuildDetailView = ({ buildId }: BuildDetailViewProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const detail = useBuildDetail(buildId);
  const { build } = detail;

  return (
    <ScreenScaffold
      scroll={false}
      header={
        <ScreenHeader
          title={detail.title}
          subtitle={detail.subtitle}
          onBack={detail.nav.back}
          accessory={
            detail.badge ? (
              <Reveal key={detail.badge.label}>
                <StatusBadge {...detail.badge} />
              </Reveal>
            ) : undefined
          }
          actions={detail.headerActions}
        />
      }
    >
      {!build ? (
        detail.error ? (
          <EmptyState
            icon={HammerIcon}
            title="Couldn't load this build"
            message={detail.error}
            actionLabel="Try again"
            onAction={detail.retry}
          />
        ) : (
          <EmptyState loading title="Loading build…" />
        )
      ) : (
        <View style={styles.body}>
          <View style={styles.summary}>
            {detail.meta ? (
              <ThemedText variant="bodySmall" color="textSecondary">
                {detail.meta}
              </ThemedText>
            ) : null}
            {detail.active ? (
              <Reveal>
                <ProgressBar progress={build.progress} label="Build progress" />
              </Reveal>
            ) : null}
            {build.error ? (
              <Reveal>
                <Notice tone="danger" title="Build failed" message={build.error} />
              </Reveal>
            ) : null}
            {detail.cancelError ? (
              <Reveal>
                <Notice tone="danger" message={detail.cancelError} />
              </Reveal>
            ) : null}
            {detail.downloads.error ? (
              <Reveal>
                <Notice tone="danger" message={detail.downloads.error} />
              </Reveal>
            ) : null}
            {build.artifacts.map((artifact, index) => (
              <MotionItem key={artifact.id} index={index}>
                <ArtifactCard
                  artifact={artifact}
                  onDownload={() => detail.downloads.download(artifact.id)}
                  downloading={detail.downloads.pendingId === artifact.id}
                />
              </MotionItem>
            ))}
          </View>
          <LogView
            lines={detail.logs.lines}
            emptyLabel={detail.logs.error ?? (detail.active ? "Waiting for output…" : "No log output.")}
          />
        </View>
      )}
    </ScreenScaffold>
  );
};

export default BuildDetailView;
