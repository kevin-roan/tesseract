import { ListGroup } from "../../../../components/GroupBand";
import { KeyedList } from "../../../../components/KeyedList";
import { RecordRow } from "../../../../components/RecordRow";
import type { ProcessInfo, Project } from "@theone/protocol";
import type { TabHost } from "../../../../features/projects/hooks/use-tab-host";
import { useProcessesTab } from "./hooks/use-processes-tab";
import { FollowerPanel, TabConfirm, TabStack } from "../kit";
import { PROCESSES_LABELS as L } from "./labels";
import { packageManager } from "./model";
import { portRow, processRow, scriptRow } from "./rows";
import { RunCommandDialog } from "./RunCommandDialog";

export interface ProcessesTabProps {
  project: Project;
  processes: readonly ProcessInfo[] | null;
  host: TabHost;
}

export function ProcessesTab({ project, processes, host }: ProcessesTabProps) {
  const tab = useProcessesTab({ project, processes, host });
  const pm = packageManager(project);
  const portHandlers = { copy: tab.copyUrl, open: tab.openUrl };
  const processHandlers = { fix: tab.fix, toggleLogs: tab.toggleLogs, stop: tab.askStop };
  const scriptHandlers = { run: tab.runScript };
  return (
    <TabStack>
      {tab.ports.length > 0 ? (
        <ListGroup icon="ports" title={L.ports} subtitle={L.portsSubtitle} count={tab.ports.length}>
          <KeyedList
            divided
            label={L.ports}
            items={tab.ports}
            getKey={(entry) => String(entry.port.port)}
            renderItem={(entry) => <RecordRow {...portRow(entry, portHandlers)} />}
          />
        </ListGroup>
      ) : null}
      <ListGroup
        icon="processes"
        title={L.list}
        count={tab.processes?.length ?? null}
        actionLabel={L.newCommand}
        onAction={tab.openRun}
        loading={tab.processes === null}
        empty={tab.processes?.length === 0}
        emptyLabel={L.listEmpty}
      >
        <KeyedList
          divided
          label={L.list}
          items={tab.processes ?? []}
          getKey={(process) => process.id}
          renderItem={(process) => (
            <RecordRow
              {...processRow(
                process,
                { logsOpen: tab.shownId === process.id, fixPending: tab.isFixPending(process.id), stopping: tab.isStopping(process.id) },
                processHandlers,
              )}
            />
          )}
        />
      </ListGroup>
      <FollowerPanel follower={tab.follower} title={tab.panelTitle} action={tab.panelAction} onClose={tab.closeLogs} />
      {project.scripts.length > 0 ? (
        <ListGroup icon="terminal" title={L.scripts} subtitle={L.scriptsSubtitle(pm)} count={project.scripts.length}>
          <KeyedList
            divided
            label={L.scripts}
            items={project.scripts}
            getKey={(script) => script}
            renderItem={(script) => <RecordRow {...scriptRow(script, pm, tab.isStarting(script), scriptHandlers)} />}
          />
        </ListGroup>
      ) : null}
      <RunCommandDialog project={project} client={tab.client} open={tab.runOpen} onStarted={tab.started} onClose={tab.closeRun} />
      <TabConfirm state={tab.confirm} />
    </TabStack>
  );
}
