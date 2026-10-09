import { FolderPlusIcon, LightningIcon, SparkleIcon } from "phosphor-react-native";

import ActionTileRow from "@/components/action-tile-row";
import ConnectionDot from "@/components/connection-dot";
import ListCard from "@/components/list-card";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import StatGrid from "@/components/stat-grid";
import AgentRunCard from "@/features/sandbox/components/agent-run-card";
import BuildCard from "@/features/sandbox/components/build-card";
import ProcessCard from "@/features/sandbox/components/process-card";
import ResourceHistory from "@/features/sandbox/components/resource-history";
import Reveal from "@/components/reveal";
import SandboxGate from "@/features/sandbox/components/sandbox-gate";
import SandboxNotices from "@/features/sandbox/components/sandbox-notices";
import MotionItem from "@/components/motion-item";
import TerminalCard from "@/features/sandbox/components/terminal-card";
import { useSandboxHub } from "@/features/sandbox/hooks/use-sandbox-hub";
import { activityTitle } from "@/features/sandbox/utils/describe";
import { frameworkIcon } from "@/features/sandbox/utils/icons";
import { projectSubtitle } from "@/features/sandbox/utils/projects";
import { linkLabel, linkTone } from "@/features/sandbox/utils/states";

export default function AgentsScreen() {
  const hub = useSandboxHub();

  if (!hub.sandbox) {
    return <SandboxGate />;
  }

  return (
    <ScreenScaffold
      refreshing={hub.refreshing}
      onRefresh={hub.refresh}
      header={
        <ScreenHeader
          title={hub.sandbox.name}
          subtitle={hub.subtitle}
          size="medium"
          status={<ConnectionDot tone={linkTone(hub.link)} label={linkLabel(hub.link)} variant="chip" />}
          actions={hub.headerActions}
        />
      }
    >
      <SandboxNotices
        missingToken={hub.missingToken}
        onPair={hub.nav.pair}
        issue={hub.issue}
        onRepair={hub.repair}
        error={hub.statusError}
        onRetry={hub.retryStatus}
      />
      {hub.removeError ? (
        <Reveal>
          <Notice tone="danger" message={hub.removeError} />
        </Reveal>
      ) : null}
      {hub.actionError ? (
        <Reveal>
          <Notice tone="danger" message={hub.actionError} />
        </Reveal>
      ) : null}
      {hub.latestActivity ? (
        <Reveal>
          <Notice
            tone="info"
            icon={LightningIcon}
            title={activityTitle(hub.latestActivity)}
            message={hub.latestActivity.message}
          />
        </Reveal>
      ) : null}

      {hub.stats.length > 0 ? (
        <MotionItem index={0}>
          <StatGrid items={hub.stats} />
        </MotionItem>
      ) : null}

      {hub.stats.length > 0 ? (
        <MotionItem index={1}>
          <ResourceHistory />
        </MotionItem>
      ) : null}

      <MotionItem index={2}>
        <Section title="Quick actions">
          <ActionTileRow items={hub.actions} />
        </Section>
      </MotionItem>

      <MotionItem index={3}>
        <Section
          title="Projects"
          actionLabel="Add"
          onPressAction={hub.addProject}
          isEmpty={!hub.projectsLoading && hub.projects.length === 0}
          emptyLabel="No projects in /workspace/projects yet. Clone a repository or start an empty one, or ask Claude to."
          emptyActionLabel="Add a project"
          emptyActionIcon={FolderPlusIcon}
          onEmptyAction={hub.addProject}
        >
          {hub.projects.map((project) => (
            <ListCard
              key={project.id}
              icon={frameworkIcon(project.framework)}
              title={project.name}
              subtitle={projectSubtitle(project)}
              onPress={() => hub.nav.project(project.id)}
            />
          ))}
        </Section>
      </MotionItem>

      {hub.runningProcesses.length > 0 ? (
        <MotionItem index={4}>
          <Section title="Running">
            {hub.runningProcesses.map((process) => (
              <ProcessCard
                key={process.id}
                process={process}
                onPress={hub.processPress(process)}
                onStop={() => hub.stopProcess(process.id)}
                stopping={hub.stoppingId === process.id}
              />
            ))}
          </Section>
        </MotionItem>
      ) : null}

      {hub.sessions.length > 0 ? (
        <MotionItem index={5}>
          <Section title="Sessions">
            {hub.sessions.map((terminal) => (
              <TerminalCard
                key={terminal.id}
                terminal={terminal}
                projectName={hub.projectName(terminal.projectId)}
                onOpen={() => hub.nav.terminal(terminal.id)}
                onClose={() => void hub.closeSession(terminal)}
                closing={hub.closingId === terminal.id}
              />
            ))}
          </Section>
        </MotionItem>
      ) : null}

      <MotionItem index={6}>
        <Section
          title="Recent builds"
          isEmpty={!hub.buildsLoading && hub.recentBuilds.length === 0}
          emptyLabel="No builds yet. Open a project to build it."
        >
          {hub.recentBuilds.map((build) => (
            <BuildCard key={build.id} build={build} projectName={hub.projectName(build.projectId)} onPress={() => hub.nav.build(build.id)} />
          ))}
        </Section>
      </MotionItem>

      <MotionItem index={7}>
        <Section
          title="Claude runs"
          actionLabel="New run"
          onPressAction={() => hub.nav.newAgentRun()}
          isEmpty={!hub.runsLoading && hub.recentRuns.length === 0}
          emptyLabel="No Claude runs yet."
          emptyActionLabel="Ask Claude"
          emptyActionIcon={SparkleIcon}
          onEmptyAction={() => hub.nav.newAgentRun()}
        >
          {hub.recentRuns.map((run) => (
            <AgentRunCard key={run.id} run={run} projectName={hub.projectName(run.projectId)} onPress={() => hub.nav.agentRun(run.id)} />
          ))}
        </Section>
      </MotionItem>
    </ScreenScaffold>
  );
}
