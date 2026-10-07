import type { BuildJob, Project } from "@theone/protocol";
import { ChipGroup } from "../../../../components/Chip";
import { ListGroup } from "../../../../components/GroupBand";
import { KeyedList } from "../../../../components/KeyedList";
import { RecordRow } from "../../../../components/RecordRow";
import type { TabHost } from "../../../../features/projects/hooks/use-tab-host";
import { FollowerPanel, TabConfirm, TabStack } from "../kit";
import { useBuildsTab } from "./hooks/use-builds-tab";
import { BUILDS_LABELS as L } from "./labels";
import { buildRow, targetRow } from "./rows";

export interface BuildsTabProps {
  project: Project;
  builds: readonly BuildJob[] | null;
  host: TabHost;
}

export function BuildsTab({ project, builds, host }: BuildsTabProps) {
  const tab = useBuildsTab({ project, builds, host });
  const handlers = { fix: tab.fix, toggleLogs: tab.toggleLogs, cancel: tab.askCancel };
  const profiles =
    tab.targets.length > 0 ? (
      <ChipGroup options={tab.profileOptions} value={tab.profile} onChange={tab.setProfile} ariaLabel={L.profiles} />
    ) : null;
  return (
    <TabStack>
      <ListGroup
        icon="builds"
        title={L.targets}
        subtitle={L.targetsSubtitle}
        trailing={profiles}
        empty={tab.targets.length === 0}
        emptyLabel={L.targetsEmpty}
      >
        <KeyedList
          divided
          label={L.targets}
          items={tab.targets}
          getKey={(target) => target}
          renderItem={(target) => <RecordRow {...targetRow(target, tab.isStarting(target), tab.start)} />}
        />
      </ListGroup>
      <ListGroup
        icon="sessions"
        title={L.jobs}
        count={tab.builds?.length ?? null}
        loading={tab.builds === null}
        empty={tab.builds?.length === 0}
        emptyLabel={L.jobsEmpty}
      >
        <KeyedList
          divided
          label={L.jobs}
          items={tab.builds ?? []}
          getKey={(build) => build.id}
          renderItem={(build) => (
            <RecordRow
              {...buildRow(
                build,
                { logsOpen: tab.shownId === build.id, fixPending: tab.isFixPending(build.id), cancelling: tab.isCancelling(build.id) },
                handlers,
              )}
            />
          )}
        />
      </ListGroup>
      <FollowerPanel follower={tab.follower} title={tab.panelTitle} action={tab.panelAction} onClose={tab.closeLogs} />
      <TabConfirm state={tab.confirm} />
    </TabStack>
  );
}
