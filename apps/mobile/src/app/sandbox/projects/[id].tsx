import { useLocalSearchParams } from "expo-router";
import { FolderSimpleIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import LogView from "@/components/log-view";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import ProjectClaudeAccount from "@/features/claude-account/components/project-claude-account";
import ArtifactCard from "@/features/sandbox/components/artifact-card";
import BuildCard from "@/features/sandbox/components/build-card";
import BuildTargetCard from "@/features/sandbox/components/build-target-card";
import GitCard from "@/features/sandbox/components/git-card";
import MotionItem from "@/components/motion-item";
import ProcessCard from "@/features/sandbox/components/process-card";
import ScriptCard from "@/features/sandbox/components/script-card";
import SyncSection from "@/features/sandbox/components/sync-section";
import WebLinkCard from "@/features/sandbox/components/web-link-card";
import { useProjectDetail } from "@/features/sandbox/hooks/use-project-detail";
import { GIT_PREVIEW } from "@/features/sandbox/utils/constants";
import { firstParam } from "@/features/sandbox/utils/routes";

export default function ProjectScreen() {
  const params = useLocalSearchParams<{ id: string; process?: string }>();
  const detail = useProjectDetail(firstParam(params.id) ?? "", firstParam(params.process) ?? null);
  const { project } = detail;

  if (!project) {
    return (
      <ScreenScaffold header={<ScreenHeader title="Project" onBack={detail.nav.back} />}>
        {detail.error ? (
          <EmptyState
            icon={FolderSimpleIcon}
            title="Couldn't load this project"
            message={detail.error}
            actionLabel="Try again"
            onAction={detail.retry}
          />
        ) : (
          <EmptyState loading title="Loading project…" />
        )}
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      refreshing={detail.refreshing}
      onRefresh={detail.refresh}
      header={
        <ScreenHeader
          title={project.name}
          subtitle={detail.subtitle}
          onBack={detail.nav.back}
          actions={detail.headerActions}
        />
      }
    >
      {detail.actionError ? (
        <MotionItem>
          <Notice tone="danger" message={detail.actionError} />
        </MotionItem>
      ) : null}

      {project.git ? (
        <MotionItem index={0}>
          <Section title="Git">
            <GitCard
              summary={project.git}
              details={detail.git}
              fileLimit={GIT_PREVIEW.files}
              commitLimit={GIT_PREVIEW.commits}
            />
          </Section>
        </MotionItem>
      ) : null}

      <MotionItem index={1}>
        <SyncSection sync={detail.sync} />
      </MotionItem>

      {detail.claudeAccount.visible ? (
        <MotionItem index={1}>
          <ProjectClaudeAccount state={detail.claudeAccount} />
        </MotionItem>
      ) : null}

      {detail.sites.length > 0 ? (
        <MotionItem index={2}>
          <Section title="Websites" testID="project-sites">
            {detail.siteError ? (
              <MotionItem>
                <Notice tone="danger" message={detail.siteError} />
              </MotionItem>
            ) : null}
            {detail.sites.map((site) => (
              <MotionItem key={site.port}>
                <WebLinkCard site={site} onOpen={detail.openSite} />
              </MotionItem>
            ))}
          </Section>
        </MotionItem>
      ) : null}

      <MotionItem index={3}>
        <Section title="Scripts" isEmpty={detail.scripts.length === 0} emptyLabel="No package scripts found.">
          {detail.scripts.map(({ script, command, bookmarked }) => (
            <ScriptCard
              key={script}
              script={script}
              command={command}
              preferDisplay={detail.preferDisplay}
              onRun={(display) => detail.runScript(script, display)}
              running={detail.runningScript === script}
              bookmarked={bookmarked}
              onToggleBookmark={() => detail.toggleBookmark(script)}
            />
          ))}
        </Section>
      </MotionItem>

      <MotionItem index={4}>
        <Section title="Build" isEmpty={detail.targets.length === 0} emptyLabel="No build targets detected.">
          {detail.targets.map((option) => (
            <BuildTargetCard
              key={option.target}
              option={option}
              onBuild={(profile) => detail.build(option.target, profile)}
              building={detail.buildingTarget === option.target}
            />
          ))}
        </Section>
      </MotionItem>

      <MotionItem index={5}>
        <Section title="Processes" isEmpty={detail.processes.length === 0} emptyLabel="Nothing has run here yet.">
          {detail.processes.map((process) => (
            <MotionItem key={process.id}>
              <ProcessCard
                process={process}
                onStop={() => detail.stopProcess(process.id)}
                stopping={detail.stoppingId === process.id}
                onToggleLogs={() => detail.toggleLogs(process.id)}
                logsOpen={detail.logsId === process.id}
                site={detail.siteFor(process.id)}
                onOpenSite={detail.openSite}
              />
            </MotionItem>
          ))}
          {detail.logsId ? (
            <MotionItem key={`logs-${detail.logsId}`}>
              <LogView
                lines={detail.logs.lines}
                emptyLabel={detail.logs.error ?? "Waiting for output…"}
                inline
              />
            </MotionItem>
          ) : null}
        </Section>
      </MotionItem>

      {detail.builds.length > 0 ? (
        <MotionItem index={6}>
          <Section title="Recent builds">
            {detail.builds.map((build) => (
              <MotionItem key={build.id}>
                <BuildCard build={build} onPress={() => detail.nav.build(build.id)} />
              </MotionItem>
            ))}
          </Section>
        </MotionItem>
      ) : null}

      <MotionItem index={7}>
        <Section title="Artifacts" isEmpty={detail.artifacts.length === 0} emptyLabel="No artifacts yet.">
          {detail.downloads.error ? (
            <MotionItem>
              <Notice tone="danger" message={detail.downloads.error} />
            </MotionItem>
          ) : null}
          {detail.artifacts.map((artifact) => (
            <MotionItem key={artifact.id}>
              <ArtifactCard
                artifact={artifact}
                onDownload={() => detail.downloads.download(artifact.id)}
                downloading={detail.downloads.pendingId === artifact.id}
              />
            </MotionItem>
          ))}
        </Section>
      </MotionItem>
    </ScreenScaffold>
  );
}
