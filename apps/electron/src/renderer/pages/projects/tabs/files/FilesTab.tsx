import type { Project, ProjectFile } from "@tesseract/protocol";
import { Breadcrumbs } from "../../../../components/Breadcrumbs";
import { ConfirmDialog } from "../../../../components/ConfirmDialog";
import { ListGroup } from "../../../../components/GroupBand";
import { KeyedList } from "../../../../components/KeyedList";
import { Notice } from "../../../../components/Notice";
import { Reveal } from "../../../../components/Reveal";
import type { TabHost } from "../../../../features/projects/hooks/use-tab-host";
import { formatLabel, TAILDROP_LABELS } from "../../../../features/files/labels";
import { TabStack } from "../kit";
import { FOLDER_ICON, UP_ICON } from "./constants";
import { FileRow } from "./FileRow";
import { useFilesTab } from "./hooks/use-files-tab";
import { FILES_TAB_LABELS as L } from "./labels";

export interface FilesTabProps {
  project: Project;
  host: TabHost;
}

const fileKey = (file: ProjectFile) => file.path;

export function FilesTab({ project, host }: FilesTabProps) {
  const tab = useFilesTab({ projectId: project.id, rootLabel: project.name, host });
  const { actions, directory } = tab;
  const entries = directory?.entries ?? [];
  const notice = tab.error ?? (directory?.truncated ? L.truncated(entries.length) : null);
  return (
    <TabStack>
      <Breadcrumbs crumbs={tab.crumbs} label={L.trail} onSelect={tab.navigate} />
      <Reveal open={notice !== null}>{notice ? <Notice message={notice} tone={tab.error ? "danger" : "neutral"} /> : null}</Reveal>
      <ListGroup
        icon={FOLDER_ICON}
        title={tab.crumbs[tab.crumbs.length - 1]?.label ?? L.list}
        count={directory ? entries.length : null}
        actionLabel={tab.atRoot ? L.refresh : L.up}
        actionIcon={tab.atRoot ? undefined : UP_ICON}
        onAction={tab.atRoot ? tab.refresh : tab.up}
        loading={tab.loading}
        loadingLabel={L.loading}
        empty={directory !== null && entries.length === 0}
        emptyLabel={L.empty}
      >
        <KeyedList
          divided
          label={L.list}
          items={entries}
          getKey={fileKey}
          renderItem={(file) => <FileRow file={file} actions={actions} onOpen={tab.open} />}
        />
      </ListGroup>
      {actions.dialog ? (
        <ConfirmDialog
          open={actions.dialogOpen}
          heading={formatLabel(TAILDROP_LABELS.title, { name: actions.dialog.file.name })}
          body={TAILDROP_LABELS.body}
          confirmLabel={TAILDROP_LABELS.confirm}
          cancelLabel={TAILDROP_LABELS.cancel}
          destructive={false}
          options={actions.dialog.options}
          chooseLabel={TAILDROP_LABELS.target}
          onConfirm={actions.confirmSend}
          onClose={actions.closeDialog}
          onExitComplete={actions.clearDialog}
        />
      ) : null}
    </TabStack>
  );
}
