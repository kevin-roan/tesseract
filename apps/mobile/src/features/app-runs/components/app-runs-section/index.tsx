import { Fragment, type ReactNode } from "react";
import type { AppRun } from "@theone/protocol";

import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import Section from "@/components/section";

import type { AppRunsState } from "../../hooks/use-app-runs";
import { APP_RUNS_COPY } from "../../utils/content";
import AppRunCard from "../app-run-card";

export type AppRunsSectionProps = {
  runs: AppRunsState;
  logsOpen: (processId: string | undefined) => boolean;
  onToggleLogs: (processId: string) => void;
  logs: ReactNode;
  onFix?: (run: AppRun, label: string) => void;
  fixingId?: string | null;
};

const AppRunsSection = ({ runs, logsOpen, onToggleLogs, logs, onFix, fixingId = null }: AppRunsSectionProps) => {
  return (
    <Section
      title={APP_RUNS_COPY.title}
      loading={runs.loading}
      isEmpty={runs.entries.length === 0}
      emptyLabel={APP_RUNS_COPY.empty}
      testID="project-runs"
    >
      {runs.error ? (
        <MotionItem>
          <Notice tone="danger" message={runs.error} />
        </MotionItem>
      ) : null}
      {runs.entries.map((entry) => {
        const { run } = entry;
        const processId = run?.processIds[0];
        const failure = run ? runs.deeplinkFailureFor(run.id) : null;
        return (
          <Fragment key={entry.target}>
            {failure ? (
              <MotionItem>
                <Notice
                  tone="warning"
                  title={APP_RUNS_COPY.deeplinkTitle}
                  message={APP_RUNS_COPY.deeplinkMessage(failure.manifestUrl)}
                  actionLabel={
                    runs.copyManifest.canCopy ? (runs.copyManifest.copied ? APP_RUNS_COPY.copied : APP_RUNS_COPY.copyUrl) : undefined
                  }
                  onAction={runs.copyManifest.canCopy ? () => void runs.copyManifest.copy() : undefined}
                />
              </MotionItem>
            ) : null}
            <MotionItem>
              <AppRunCard
                entry={entry}
                onStart={() => runs.start(entry.target)}
                starting={runs.startingTarget === entry.target}
                onSetupEmulator={runs.setupEmulator}
                onOpen={() => run && runs.open(run, entry.label)}
                onAction={(action) => run && runs.runAction(run.id, action)}
                pendingAction={run && runs.pendingAction?.runId === run.id ? runs.pendingAction.action : null}
                onStop={() => run && runs.stop(run.id)}
                stopping={run !== null && runs.stoppingId === run.id}
                onToggleLogs={processId ? () => onToggleLogs(processId) : undefined}
                logsOpen={logsOpen(processId)}
                logs={logs}
                onFix={run && onFix ? () => onFix(run, entry.label) : undefined}
                fixing={run !== null && fixingId === run.id}
              />
            </MotionItem>
          </Fragment>
        );
      })}
    </Section>
  );
};

export default AppRunsSection;
