import { FolderPlusIcon } from "phosphor-react-native";

import ConnectionDot from "@/components/connection-dot";
import Notice from "@/components/notice";
import ProjectCard from "@/components/project-card";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import AgentRunCard from "@/features/sandbox/components/agent-run-card";
import BuildCard from "@/features/sandbox/components/build-card";
import ProcessCard from "@/features/sandbox/components/process-card";
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
          large
          accessory={<ConnectionDot tone={linkTone(screen.link)} label={linkLabel(screen.link)} />}
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
        <Section title="Running" testID="running-section">
          {screen.stopError ? <Notice tone="danger" message={screen.stopError} /> : null}
          {screen.running.processes.map((process) => (
            <ProcessCard
              key={process.id}
              process={process}
              onPress={screen.processPress(process)}
              onStop={() => screen.stopProcess(process.id)}
              stopping={screen.stoppingId === process.id}
            />
          ))}
          {screen.running.builds.map((build) => (
            <BuildCard key={build.id} build={build} onPress={() => screen.nav.build(build.id)} />
          ))}
          {screen.running.runs.map((run) => (
            <AgentRunCard key={run.id} run={run} onPress={() => screen.nav.agentRun(run.id)} />
          ))}
        </Section>
      ) : null}

      {screen.sites.length > 0 ? (
        <Section title="Websites" testID="sites-section">
          {screen.siteError ? <Notice tone="danger" message={screen.siteError} /> : null}
          {screen.sites.map((site) => (
            <WebLinkCard key={site.port} site={site} onPress={screen.sitePress(site)} onOpen={screen.openSite} />
          ))}
        </Section>
      ) : null}

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
        {screen.projects.map(({ id, ...card }) => (
          <ProjectCard
            key={id}
            {...card}
            testID={`project-card-${id}`}
            chatLabel={`Ask Claude about ${card.title}`}
            onPress={() => screen.openProject(id)}
            onPressChat={() => screen.askClaude(id)}
          />
        ))}
      </Section>
    </ScreenScaffold>
  );
}
