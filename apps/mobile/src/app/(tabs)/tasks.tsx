import { SparkleIcon } from "phosphor-react-native";

import ConnectionDot from "@/components/connection-dot";
import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import AgentRunCard from "@/features/sandbox/components/agent-run-card";
import BuildCard from "@/features/sandbox/components/build-card";
import ProcessCard from "@/features/sandbox/components/process-card";
import SandboxGate from "@/features/sandbox/components/sandbox-gate";
import SandboxNotices from "@/features/sandbox/components/sandbox-notices";
import { useTasksScreen } from "@/features/sandbox/hooks/use-tasks-screen";
import { linkLabel, linkTone } from "@/features/sandbox/utils/states";

export default function TasksScreen() {
  const screen = useTasksScreen();

  if (!screen.sandbox) {
    return <SandboxGate />;
  }

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      header={
        <ScreenHeader
          title="Tasks"
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
        error={screen.error}
        onRetry={screen.retry}
      />

      {screen.loading && screen.runningCount === 0 && screen.finishedCount === 0 ? (
        <EmptyState loading title="Loading tasks…" />
      ) : (
        <>
          <Section
            title="Running"
            testID="tasks-running"
            isEmpty={screen.runningCount === 0}
            emptyLabel="Nothing is running. Start a script from a project, or hand Claude a job."
            emptyActionLabel="Ask Claude"
            emptyActionIcon={SparkleIcon}
            onEmptyAction={() => screen.nav.newAgentRun()}
          >
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

          <Section
            title="Finished"
            testID="tasks-finished"
            isEmpty={screen.finishedCount === 0}
            emptyLabel="Finished processes, builds and Claude runs show up here."
          >
            {screen.finished.runs.map((run) => (
              <AgentRunCard key={run.id} run={run} onPress={() => screen.nav.agentRun(run.id)} />
            ))}
            {screen.finished.builds.map((build) => (
              <BuildCard key={build.id} build={build} onPress={() => screen.nav.build(build.id)} />
            ))}
            {screen.finished.processes.map((process) => (
              <ProcessCard key={process.id} process={process} onPress={screen.processPress(process)} />
            ))}
          </Section>
        </>
      )}
    </ScreenScaffold>
  );
}
