import { FolderPlusIcon, LightningIcon, QrCodeIcon, WarningIcon } from "phosphor-react-native";

import ActionTileRow from "@/components/action-tile-row";
import ChoiceGroup from "@/components/choice-group";
import ConnectionDot from "@/components/connection-dot";
import EmptyState from "@/components/empty-state";
import ListCard from "@/components/list-card";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import StatGrid from "@/components/stat-grid";
import AgentRunCard from "@/features/sandbox/components/agent-run-card";
import BuildCard from "@/features/sandbox/components/build-card";
import ProcessCard from "@/features/sandbox/components/process-card";
import TerminalCard from "@/features/sandbox/components/terminal-card";
import { useSandboxHub } from "@/features/sandbox/hooks/use-sandbox-hub";
import { activityTitle } from "@/features/sandbox/utils/describe";
import { frameworkIcon } from "@/features/sandbox/utils/icons";
import { projectSubtitle } from "@/features/sandbox/utils/projects";
import { linkLabel, linkTone } from "@/features/sandbox/utils/states";

export default function AgentsScreen() {
  const hub = useSandboxHub();

  if (!hub.hydrated) {
    return (
      <ScreenScaffold>
        <EmptyState loading title="Loading sandboxes…" />
      </ScreenScaffold>
    );
  }

  if (!hub.sandbox) {
    return (
      <ScreenScaffold header={<ScreenHeader title="Sandbox" large />}>
        <EmptyState
          icon={QrCodeIcon}
          title="Pair a sandbox"
          message="Run `theone-controller pair` inside your sandbox, then scan the code. Everything travels over your tailnet."
          actionLabel="Pair a sandbox"
          onAction={hub.nav.pair}
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      refreshing={hub.refreshing}
      onRefresh={hub.refresh}
      header={
        <ScreenHeader
          title={hub.sandbox.name}
          subtitle={hub.subtitle}
          large
          accessory={<ConnectionDot tone={linkTone(hub.link)} label={linkLabel(hub.link)} />}
          actions={hub.headerActions}
        />
      }
    >
      {hub.switcher.length > 1 ? (
        <ChoiceGroup
          options={hub.switcher}
          selectedId={hub.sandbox.id}
          onSelect={hub.selectSandbox}
          scrollable
          label="Paired sandboxes"
        />
      ) : null}

      {hub.missingToken ? (
        <Notice
          tone="warning"
          icon={WarningIcon}
          title="Token missing"
          message="This device no longer has the token for this sandbox. Pair it again."
          actionLabel="Pair"
          onAction={hub.nav.pair}
        />
      ) : null}
      {hub.issue ? (
        <Notice
          tone="danger"
          icon={WarningIcon}
          title={hub.issue.title}
          message={hub.issue.message}
          actionLabel={hub.issue.actionLabel}
          onAction={hub.repair}
        />
      ) : null}
      {hub.statusError ? (
        <Notice tone="danger" message={hub.statusError} actionLabel="Retry" onAction={hub.retryStatus} />
      ) : null}
      {hub.removeError ? <Notice tone="danger" message={hub.removeError} /> : null}
      {hub.latestActivity ? (
        <Notice
          tone="info"
          icon={LightningIcon}
          title={activityTitle(hub.latestActivity)}
          message={hub.latestActivity.message}
        />
      ) : null}

      {hub.stats.length > 0 ? <StatGrid items={hub.stats} /> : null}

      <Section title="Quick actions">
        <ActionTileRow items={hub.actions} />
      </Section>

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

      {hub.runningProcesses.length > 0 ? (
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
      ) : null}

      {hub.sessions.length > 0 ? (
        <Section title="Sessions">
          {hub.sessions.map((terminal) => (
            <TerminalCard
              key={terminal.id}
              terminal={terminal}
              onOpen={() => hub.nav.terminal(terminal.id)}
              onClose={() => void hub.closeSession(terminal)}
              closing={hub.closingId === terminal.id}
            />
          ))}
        </Section>
      ) : null}

      <Section title="Recent builds" isEmpty={hub.recentBuilds.length === 0} emptyLabel="No builds yet.">
        {hub.recentBuilds.map((build) => (
          <BuildCard key={build.id} build={build} onPress={() => hub.nav.build(build.id)} />
        ))}
      </Section>

      <Section
        title="Claude runs"
        actionLabel="New run"
        onPressAction={() => hub.nav.newAgentRun()}
        isEmpty={hub.recentRuns.length === 0}
        emptyLabel="No Claude runs yet."
      >
        {hub.recentRuns.map((run) => (
          <AgentRunCard key={run.id} run={run} onPress={() => hub.nav.agentRun(run.id)} />
        ))}
      </Section>
    </ScreenScaffold>
  );
}
