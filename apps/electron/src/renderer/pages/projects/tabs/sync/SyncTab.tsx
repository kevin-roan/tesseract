import type { SyncFileChange, SyncRequest } from "@theone/protocol";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ListGroup } from "../../../../components/GroupBand";
import { KeyedList } from "../../../../components/KeyedList";
import { Notice } from "../../../../components/Notice";
import { RecordRow, type RowAction } from "../../../../components/RecordRow";
import { Reveal } from "../../../../components/Reveal";
import type { SnapshotSummary } from "../../../../../shared/contracts/syncback";
import type { NoticeAction } from "../../../../features/projects/types";
import { TabConfirm, TabStack } from "../kit";
import { RECENT_REQUESTS } from "./constants";
import { useSyncActions } from "./hooks/use-sync-actions";
import { useSyncView } from "./hooks/use-sync-view";
import { SYNC_LABELS } from "./labels";
import {
  changeMeta,
  changesSubtitle,
  isConflict,
  requestMeta,
  requestSubtitle,
  requestTitle,
  snapshotMeta,
  summaryRows,
  syncChangeCode,
  syncFiles,
  syncNotice,
  syncRequestState,
  syncSections,
} from "./model";
import { SyncReviewDialog } from "./review/SyncReviewDialog";
import { SyncActionsBar } from "./SyncActionsBar";
import { SyncSummary } from "./SyncSummary";

export interface SyncTabProps {
  projectId: string;
  visible?: boolean;
  report(error: unknown, action?: NoticeAction): void;
  onCount?: (count: number) => void;
}

const changeKey = (change: SyncFileChange) => change.path;
const requestKey = (request: SyncRequest) => request.id;
const snapshotKey = (snapshot: SnapshotSummary) => snapshot.id;

const renderSnapshot = (snapshot: SnapshotSummary) => (
  <RecordRow
    icon="sessions"
    title={snapshot.id}
    monospaceTitle
    meta={snapshotMeta(snapshot)}
    status={snapshot.reverted ? { label: SYNC_LABELS.reverted, tone: "neutral" } : null}
  />
);

export function SyncTab({ projectId, visible = true, report, onCount }: SyncTabProps) {
  const sync = useSyncView(projectId, visible);
  const actions = useSyncActions({ projectId, sync, report });
  const { view, loaded } = sync;
  const files = syncFiles(view);
  const notice = loaded ? syncNotice(view) : null;
  const sections = syncSections(view);

  const reportRef = useRef(report);
  reportRef.current = report;
  useEffect(() => onCount?.(files.length), [files.length, onCount]);
  useEffect(() => {
    if (sync.error) reportRef.current(sync.error);
  }, [sync.error]);

  const renderChange = useCallback(
    (change: SyncFileChange) => {
      const { code, tone } = syncChangeCode(change.kind);
      const conflict = isConflict(view, change.path);
      return (
        <RecordRow
          title={change.path}
          monospaceTitle
          code={code}
          codeTone={tone}
          meta={changeMeta(view, change)}
          status={conflict ? { label: SYNC_LABELS.conflictBadge, tone: "warning" } : null}
        />
      );
    },
    [view],
  );

  const { cancelRequest } = actions;
  const renderRequest = useCallback(
    (request: SyncRequest) => {
      const state = syncRequestState(request.status);
      const rowActions: RowAction[] =
        request.status === "pending"
          ? [{ id: "cancel", icon: "stop", label: SYNC_LABELS.cancelRequest, destructive: true, onActivate: () => cancelRequest(request) }]
          : [];
      return (
        <RecordRow
          icon="host"
          title={requestTitle(request)}
          subtitle={requestSubtitle(request)}
          meta={requestMeta(request)}
          status={{ label: state.label, tone: state.tone, glyph: true }}
          actions={rowActions}
        />
      );
    },
    [cancelRequest],
  );

  const requests = useMemo(() => view.requests.slice(0, RECENT_REQUESTS), [view.requests]);
  const changesLoading = !loaded || (view.changes === null && view.error === null);

  return (
    <TabStack>
      <Reveal open={notice !== null}>{notice ? <Notice message={notice.message} tone={notice.tone} /> : null}</Reveal>
      <Reveal open={actions.result !== null}>
        {actions.result ? (
          <Notice
            message={actions.result.message}
            tone={actions.result.tone}
            actionLabel={SYNC_LABELS.dismiss}
            onAction={actions.dismissResult}
          />
        ) : null}
      </Reveal>
      {sections.summary ? <SyncSummary rows={summaryRows(view)} /> : null}
      <SyncActionsBar buttons={actions.buttons} />
      {sections.changes ? (
        <ListGroup
          icon="sync"
          title={SYNC_LABELS.changes}
          subtitle={changesLoading ? null : changesSubtitle(view)}
          loading={changesLoading}
          empty={files.length === 0}
          emptyLabel={SYNC_LABELS.changesEmpty}
        >
          <KeyedList items={files} getKey={changeKey} renderItem={renderChange} divided label={SYNC_LABELS.changesList} />
        </ListGroup>
      ) : null}
      {sections.requests ? (
        <ListGroup icon="host" title={SYNC_LABELS.requests} empty={requests.length === 0} emptyLabel={SYNC_LABELS.requestsEmpty}>
          <KeyedList items={requests} getKey={requestKey} renderItem={renderRequest} divided label={SYNC_LABELS.requestsList} />
        </ListGroup>
      ) : null}
      {sections.snapshots ? (
        <ListGroup
          icon="sessions"
          title={SYNC_LABELS.snapshots}
          subtitle={SYNC_LABELS.snapshotsSubtitle}
          empty={view.snapshots.length === 0}
          emptyLabel={SYNC_LABELS.snapshotsEmpty}
        >
          <KeyedList items={view.snapshots} getKey={snapshotKey} renderItem={renderSnapshot} divided label={SYNC_LABELS.snapshotsList} />
        </ListGroup>
      ) : null}
      <TabConfirm state={actions.confirm} />
      {actions.review ? (
        <SyncReviewDialog
          projectId={projectId}
          view={actions.review}
          open={actions.reviewOpen}
          onClose={actions.closeReview}
          onConfirm={actions.confirmReview}
          onExitComplete={actions.clearReview}
        />
      ) : null}
    </TabStack>
  );
}
