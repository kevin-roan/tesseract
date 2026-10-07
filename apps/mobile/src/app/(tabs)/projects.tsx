import { FolderPlusIcon } from "phosphor-react-native";

import ConnectionDot from "@/components/connection-dot";
import MenuSheet from "@/components/menu-sheet";
import Notice from "@/components/notice";
import ProjectCard from "@/components/project-card";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import SegmentedPills from "@/components/segmented-pills";
import Section from "@/components/section";
import AgentRunCard from "@/features/sandbox/components/agent-run-card";
import BuildCard from "@/features/sandbox/components/build-card";
import MotionItem from "@/components/motion-item";
import ProcessCard from "@/features/sandbox/components/process-card";
import RenameProjectSheet from "@/features/sandbox/components/rename-project-sheet";
import SandboxGate from "@/features/sandbox/components/sandbox-gate";
import SandboxNotices from "@/features/sandbox/components/sandbox-notices";
import WebLinkCard from "@/features/sandbox/components/web-link-card";
import { useProjectsScreen } from "@/features/sandbox/hooks/use-projects-screen";
import { linkLabel, linkTone } from "@/features/sandbox/utils/states";

export default function ProjectsScreen() {
  const screen = useProjectsScreen();

  if (!screen.sandbox) {
    return <SandboxGate />;
  }

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      header={
        <ScreenHeader
          title="Projects"
          subtitle={screen.sandbox.name}
          size="medium"
          status={<ConnectionDot tone={linkTone(screen.link)} label={linkLabel(screen.link)} variant="chip" />}
          actions={screen.headerActions}
        />
      }
    >
      <SandboxNotices
        missingToken={screen.missingToken}
        onPair={screen.nav.pair}
        issue={screen.issue}
        onRepair={screen.repair}
        error={screen.projectsError}
        onRetry={screen.retryProjects}
      />

      {screen.runningCount > 0 ? (
        <MotionItem index={0}>
          <Section title="Running" testID="running-section">
            {screen.stopError ? (
              <MotionItem>
                <Notice tone="danger" message={screen.stopError} />
              </MotionItem>
            ) : null}
            {screen.running.processes.map((process) => (
              <MotionItem key={process.id}>
                <ProcessCard
                  process={process}
                  onPress={screen.processPress(process)}
                  onStop={() => screen.stopProcess(process.id)}
                  stopping={screen.stoppingId === process.id}
                />
              </MotionItem>
            ))}
            {screen.running.builds.map((build) => (
              <MotionItem key={build.id}>
                <BuildCard build={build} projectName={screen.projectName(build.projectId)} onPress={() => screen.nav.build(build.id)} />
              </MotionItem>
            ))}
            {screen.running.runs.map((run) => (
              <MotionItem key={run.id}>
                <AgentRunCard run={run} projectName={screen.projectName(run.projectId)} onPress={() => screen.nav.agentRun(run.id)} />
              </MotionItem>
            ))}
          </Section>
        </MotionItem>
      ) : null}

      {screen.sites.length > 0 ? (
        <MotionItem index={1}>
          <SegmentedPills options={screen.viewOptions} value={screen.view} onChange={screen.selectView} />
        </MotionItem>
      ) : null}

      {screen.view === "sites" ? (
        <MotionItem index={2}>
          <Section title="Websites" testID="sites-section">
            {screen.siteError ? (
              <MotionItem>
                <Notice tone="danger" message={screen.siteError} />
              </MotionItem>
            ) : null}
            {screen.sites.map((site) => (
              <MotionItem key={site.port}>
                <WebLinkCard site={site} onPress={screen.sitePress(site)} onOpen={screen.openSite} />
              </MotionItem>
            ))}
          </Section>
        </MotionItem>
      ) : (
        <MotionItem index={2}>
          <Section
            title="All projects"
            testID="projects-list"
            actionLabel="Add"
            onPressAction={screen.addProject}
            loading={screen.projectsLoading && screen.projects.length === 0}
            loadingLabel="Loading projects…"
            isEmpty={!screen.projectsLoading && screen.projects.length === 0}
            emptyLabel="No projects in /workspace/projects yet. Clone a repository or start an empty one, or ask Claude to."
            emptyActionLabel="Add a project"
            emptyActionIcon={FolderPlusIcon}
            onEmptyAction={screen.addProject}
          >
            {screen.removeError ? (
              <MotionItem>
                <Notice tone="danger" message={screen.removeError} />
              </MotionItem>
            ) : null}
            {screen.projects.map(({ id, ...card }, index) => (
              <MotionItem key={id} index={index}>
                <ProjectCard
                  {...card}
                  testID={`project-card-${id}`}
                  chatLabel={`Ask Claude about ${card.title}`}
                  onPress={() => screen.openProject(id)}
                  onPressChat={() => screen.askClaude(id)}
                  onPressMenu={() => screen.projectMenu({ id, title: card.title })}
                />
              </MotionItem>
            ))}
          </Section>
        </MotionItem>
      )}

      <MenuSheet testID="project-menu" {...screen.projectMenuSheet} />
      <RenameProjectSheet state={screen.renameSheet} />
    </ScreenScaffold>
  );
}
