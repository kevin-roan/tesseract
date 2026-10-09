import { useLocalSearchParams } from "expo-router";
import { FolderSimpleIcon } from "phosphor-react-native";

import ChipRow from "@/components/chip-row";
import EmptyState from "@/components/empty-state";
import LogView from "@/components/log-view";
import MenuSheet from "@/components/menu-sheet";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import ChatList from "@/features/chats/components/chat-list";
import AppRunsSection from "@/features/app-runs/components/app-runs-section";
import ProjectClaudeAccount from "@/features/claude-account/components/project-claude-account";
import ArtifactCard from "@/features/sandbox/components/artifact-card";
import BuildCard from "@/features/sandbox/components/build-card";
import BuildTargetCard from "@/features/sandbox/components/build-target-card";
import GitCard from "@/features/sandbox/components/git-card";
import MotionItem from "@/components/motion-item";
import ProcessCard from "@/features/sandbox/components/process-card";
import RenameProjectSheet from "@/features/sandbox/components/rename-project-sheet";
import ScriptCard from "@/features/sandbox/components/script-card";
import SyncSection from "@/features/sandbox/components/sync-section";
import StorageSheet from "@/features/storage/components/storage-sheet";
import WebLinkCard from "@/features/sandbox/components/web-link-card";
import { useProjectDetail } from "@/features/sandbox/hooks/use-project-detail";
import { GIT_PREVIEW } from "@/features/sandbox/utils/constants";
import { PROJECT_COPY } from "@/features/sandbox/utils/project-content";
import { firstParam } from "@/features/sandbox/utils/routes";

export default function ProjectScreen() {
  const params = useLocalSearchParams<{ id: string; process?: string }>();
  const detail = useProjectDetail(firstParam(params.id) ?? "", firstParam(params.process) ?? null);
  const { project } = detail;

  if (!project) {
    return (
      <ScreenScaffold header={<ScreenHeader title={PROJECT_COPY.title} onBack={detail.nav.back} />}>
        {detail.error ? (
          <EmptyState
            icon={FolderSimpleIcon}
            title={PROJECT_COPY.failedTitle}
            message={detail.error}
            actionLabel={PROJECT_COPY.retry}
            onAction={detail.retry}
          />
        ) : (
          <EmptyState loading title={PROJECT_COPY.loading} />
        )}
      </ScreenScaffold>
    );
  }

  const logView = <LogView lines={detail.logs.lines} emptyLabel={detail.logs.error ?? PROJECT_COPY.waitingForOutput} inline />;

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
      <MotionItem index={0}>
        <ChipRow items={detail.chips} label={PROJECT_COPY.chips} testID="project-chips" />
      </MotionItem>

      {detail.actionError ? (
        <MotionItem>
          <Notice tone="danger" message={detail.actionError} />
        </MotionItem>
      ) : null}

      {project.git ? (
        <MotionItem index={0}>
          <Section title={PROJECT_COPY.sections.git}>
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
        <Section
          title={PROJECT_COPY.sections.chats}
          actionLabel={PROJECT_COPY.allChats}
          onPressAction={detail.chats.viewAll}
          isEmpty={!detail.chats.loading && !detail.chats.error && detail.chats.items.length === 0}
          emptyLabel={PROJECT_COPY.empty.chats}
          emptyActionLabel={PROJECT_COPY.newChat}
          onEmptyAction={detail.chats.newChat}
          testID="project-chats"
        >
          <ChatList
            items={detail.chats.items}
            loading={detail.chats.loading}
            error={detail.chats.error}
            onRetry={detail.chats.retry}
            onOpen={detail.chats.open}
            projectName={() => null}
          />
        </Section>
      </MotionItem>

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
          <Section title={PROJECT_COPY.sections.sites} testID="project-sites">
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
        <AppRunsSection
          runs={detail.appRuns}
          logsOpen={(id) => detail.logsOpen(id, "app")}
          onToggleLogs={(id) => detail.toggleLogs(id, "app")}
          logs={logView}
          onFix={(run, label) => void detail.fixAppRun(run, label)}
          fixingId={detail.fixingId}
        />
      </MotionItem>

      <MotionItem index={3}>
        <Section title={PROJECT_COPY.sections.scripts} isEmpty={detail.scripts.length === 0} emptyLabel={PROJECT_COPY.empty.scripts}>
          {detail.needsInstall ? (
            <Notice message={PROJECT_COPY.needsInstall} />
          ) : null}
          {detail.scripts.map(({ script, command, bookmarked, run }) => (
            <ScriptCard
              key={script}
              script={script}
              command={command}
              preferDisplay={detail.preferDisplay}
              offerDisplay={detail.offerDisplay}
              onRun={(display) => detail.runScript(script, display)}
              onShowDisplay={detail.nav.display}
              running={detail.runningScript === script}
              bookmarked={bookmarked}
              onToggleBookmark={() => detail.toggleBookmark(script)}
              run={run}
              logsOpen={detail.logsOpen(run?.id, "script")}
              onToggleLogs={run ? () => detail.toggleLogs(run.id, "script") : undefined}
              logs={logView}
              onStop={run ? () => detail.stopProcess(run.id) : undefined}
              stopping={run !== undefined && detail.stoppingId === run.id}
              onFix={run ? () => void detail.fixProcess(run) : undefined}
              fixing={run !== undefined && detail.fixingId === run.id}
            />
          ))}
        </Section>
      </MotionItem>

      <MotionItem index={4}>
        <Section title={PROJECT_COPY.sections.build} isEmpty={detail.targets.length === 0} emptyLabel={PROJECT_COPY.empty.build}>
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
        <Section title={PROJECT_COPY.sections.processes} isEmpty={detail.processes.length === 0} emptyLabel={PROJECT_COPY.empty.processes}>
          {detail.processes.map((process) => (
            <MotionItem key={process.id}>
              <ProcessCard
                process={process}
                onStop={() => detail.stopProcess(process.id)}
                stopping={detail.stoppingId === process.id}
                onToggleLogs={() => detail.toggleLogs(process.id, "process")}
                logsOpen={detail.logsOpen(process.id, "process")}
                logs={logView}
                site={detail.siteFor(process.id)}
                onOpenSite={detail.openSite}
                onFix={() => void detail.fixProcess(process)}
                fixing={detail.fixingId === process.id}
              />
            </MotionItem>
          ))}
        </Section>
      </MotionItem>

      {detail.builds.length > 0 ? (
        <MotionItem index={6}>
          <Section title={PROJECT_COPY.sections.builds}>
            {detail.builds.map((build) => (
              <MotionItem key={build.id}>
                <BuildCard build={build} projectName={project.name} onPress={() => detail.nav.build(build.id)} />
              </MotionItem>
            ))}
          </Section>
        </MotionItem>
      ) : null}

      <MotionItem index={7}>
        <Section title={PROJECT_COPY.sections.artifacts} isEmpty={detail.artifacts.length === 0} emptyLabel={PROJECT_COPY.empty.artifacts}>
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

      <MenuSheet testID="project-actions-menu" {...detail.actionsMenu} />
      <RenameProjectSheet state={detail.renameSheet} />
      <StorageSheet state={detail.storage} />
    </ScreenScaffold>
  );
}
