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
import Reveal from "@/components/reveal";
import SandboxGate from "@/features/sandbox/components/sandbox-gate";
import SandboxNotices from "@/features/sandbox/components/sandbox-notices";
import MotionItem from "@/components/motion-item";
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
        error={screen.error}
        onRetry={screen.retry}
      />

      {screen.loading && screen.runningCount === 0 && screen.finishedCount === 0 ? (
        <EmptyState loading title="Loading tasks…" />
      ) : (
        <>
          <MotionItem index={0}>
            <Section
              title="Running"
              testID="tasks-running"
              isEmpty={screen.runningCount === 0}
              emptyLabel="Nothing is running. Start a script from a project, or hand Claude a job."
              emptyActionLabel="Ask Claude"
              emptyActionIcon={SparkleIcon}
              onEmptyAction={() => screen.nav.newAgentRun()}
            >
              {screen.stopError ? (
                <Reveal>
                  <Notice tone="danger" message={screen.stopError} />
                </Reveal>
              ) : null}
              {screen.running.processes.map((process) => (
                <Reveal key={process.id}>
                  <ProcessCard
                    process={process}
                    onPress={screen.processPress(process)}
                    onStop={() => screen.stopProcess(process.id)}
                    stopping={screen.stoppingId === process.id}
                  />
                </Reveal>
              ))}
              {screen.running.builds.map((build) => (
                <Reveal key={build.id}>
                  <BuildCard build={build} projectName={screen.projectName(build.projectId)} onPress={() => screen.nav.build(build.id)} />
                </Reveal>
              ))}
              {screen.running.runs.map((run) => (
                <Reveal key={run.id}>
                  <AgentRunCard run={run} projectName={screen.projectName(run.projectId)} onPress={() => screen.nav.agentRun(run.id)} />
                </Reveal>
              ))}
            </Section>
          </MotionItem>

          <MotionItem index={1}>
            <Section
              title="Finished"
              testID="tasks-finished"
              isEmpty={screen.finishedCount === 0}
              emptyLabel="Finished processes, builds and Claude runs show up here."
            >
              {screen.finished.runs.map((run) => (
                <Reveal key={run.id}>
                  <AgentRunCard run={run} projectName={screen.projectName(run.projectId)} onPress={() => screen.nav.agentRun(run.id)} />
                </Reveal>
              ))}
              {screen.finished.builds.map((build) => (
                <Reveal key={build.id}>
                  <BuildCard build={build} projectName={screen.projectName(build.projectId)} onPress={() => screen.nav.build(build.id)} />
                </Reveal>
              ))}
              {screen.finished.processes.map((process) => (
                <Reveal key={process.id}>
                  <ProcessCard process={process} onPress={screen.processPress(process)} />
                </Reveal>
              ))}
            </Section>
          </MotionItem>
        </>
      )}
    </ScreenScaffold>
  );
}
