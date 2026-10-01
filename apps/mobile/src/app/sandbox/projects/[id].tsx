import { useLocalSearchParams } from "expo-router";
import { FolderSimpleIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import LogView from "@/components/log-view";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import ArtifactCard from "@/features/sandbox/components/artifact-card";
import BuildCard from "@/features/sandbox/components/build-card";
import BuildTargetCard from "@/features/sandbox/components/build-target-card";
import GitCard from "@/features/sandbox/components/git-card";
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
      {detail.actionError ? <Notice tone="danger" message={detail.actionError} /> : null}

      {project.git ? (
        <Section title="Git">
          <GitCard
            summary={project.git}
            details={detail.git}
            fileLimit={GIT_PREVIEW.files}
            commitLimit={GIT_PREVIEW.commits}
          />
        </Section>
      ) : null}

      <SyncSection sync={detail.sync} />

      {detail.sites.length > 0 ? (
        <Section title="Websites" testID="project-sites">
          {detail.siteError ? <Notice tone="danger" message={detail.siteError} /> : null}
          {detail.sites.map((site) => (
            <WebLinkCard key={site.port} site={site} onOpen={detail.openSite} />
          ))}
        </Section>
      ) : null}

      <Section title="Scripts" isEmpty={detail.scripts.length === 0} emptyLabel="No package scripts found.">
        {detail.scripts.map(({ script, command }) => (
          <ScriptCard
            key={script}
            script={script}
            command={command}
            preferDisplay={detail.preferDisplay}
            onRun={(display) => detail.runScript(script, display)}
            running={detail.runningScript === script}
          />
        ))}
      </Section>

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

      <Section title="Processes" isEmpty={detail.processes.length === 0} emptyLabel="Nothing has run here yet.">
        {detail.processes.map((process) => (
          <ProcessCard
            key={process.id}
            process={process}
            onStop={() => detail.stopProcess(process.id)}
            stopping={detail.stoppingId === process.id}
            onToggleLogs={() => detail.toggleLogs(process.id)}
            logsOpen={detail.logsId === process.id}
            site={detail.siteFor(process.id)}
            onOpenSite={detail.openSite}
          />
        ))}
        {detail.logsId ? (
          <LogView
            lines={detail.logs.lines}
            emptyLabel={detail.logs.error ?? "Waiting for output…"}
            inline
          />
        ) : null}
      </Section>

      {detail.builds.length > 0 ? (
        <Section title="Recent builds">
          {detail.builds.map((build) => (
            <BuildCard key={build.id} build={build} onPress={() => detail.nav.build(build.id)} />
          ))}
        </Section>
      ) : null}

      <Section title="Artifacts" isEmpty={detail.artifacts.length === 0} emptyLabel="No artifacts yet.">
        {detail.downloads.error ? <Notice tone="danger" message={detail.downloads.error} /> : null}
        {detail.artifacts.map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            artifact={artifact}
            onDownload={() => detail.downloads.download(artifact.id)}
            downloading={detail.downloads.pendingId === artifact.id}
          />
        ))}
      </Section>
    </ScreenScaffold>
  );
}
