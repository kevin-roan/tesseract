import type { SyncRequest } from "@tesseract/protocol";
import { useCallback, useMemo, useState } from "react";
import { describeError } from "../../../../../app/connection";
import { useApiClient } from "../../../../../app/data";
import type { ActionButtonVariant } from "../../../../../components/ActionButton";
import { showToast } from "../../../../../components/Toast";
import { ipc } from "../../../../../lib/ipc";
import type { IconName } from "../../../../../theme/icons";
import type { Tone } from "../../../../../theme/colors";
import type { SyncKind } from "../../../../../../shared/contracts/syncback";
import type { NoticeAction } from "../../../../../features/projects/types";
import { useConfirm, type ConfirmState } from "../../kit";
import { SYNC_ACTIONS, SYNC_BUTTONS } from "../constants";
import { SYNC_HINTS, SYNC_LABELS } from "../labels";
import {
  discardable,
  discardBody,
  discardSummary,
  getConfirmBody,
  plural,
  revertBody,
  revertible,
  syncBlockers,
  syncFiles,
  syncWaiting,
  getConflicts,
  type SyncAction,
  type SyncView,
} from "../model";
import type { SyncViewState } from "./use-sync-view";

export interface SyncActionButton {
  id: SyncAction;
  label: string;
  icon: IconName;
  variant: ActionButtonVariant;
  disabled: boolean;
  tooltip: string;
  onClick(): void;
}

export interface SyncResultNotice {
  message: string;
  tone: Tone;
}

export interface SyncActionsOptions {
  projectId: string | null;
  sync: SyncViewState;
  report(error: unknown, action?: NoticeAction): void;
}

export interface SyncActionsState {
  buttons: SyncActionButton[];
  confirm: ConfirmState;
  review: SyncView | null;
  reviewOpen: boolean;
  closeReview(): void;
  clearReview(): void;
  confirmReview(force: boolean, paths: string[]): void;
  result: SyncResultNotice | null;
  dismissResult(): void;
  cancelRequest(request: SyncRequest): void;
}

const LABELS: Record<SyncAction, string> = {
  pull: SYNC_LABELS.sync,
  get: SYNC_LABELS.get,
  revert: SYNC_LABELS.revert,
  discard: SYNC_LABELS.discard,
};

export function useSyncActions({ projectId, sync, report }: SyncActionsOptions): SyncActionsState {
  const client = useApiClient();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);
  const [review, setReview] = useState<SyncView | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [result, setResult] = useState<SyncResultNotice | null>(null);
  const { view, busy, refresh } = sync;

  const submit = useCallback(
    (kind: SyncKind, force: boolean, paths: string[] | null) => {
      if (projectId === null) return;
      setPending(true);
      ipc.syncback
        .submit(projectId, kind, paths ? { force, paths } : { force })
        .then(refresh, (error: unknown) => report(error))
        .finally(() => setPending(false));
      showToast(SYNC_LABELS.queued[kind]);
    },
    [projectId, refresh, report],
  );

  const discard = useCallback(
    (paths: string[]) => {
      if (projectId === null || client === null) return;
      setPending(true);
      client
        .syncDiscard(projectId, { paths })
        .then(
          (outcome) => setResult(discardSummary(outcome)),
          (error: unknown) => setResult({ message: SYNC_LABELS.discardFailed(describeError(error)), tone: "danger" }),
        )
        .finally(() => {
          setPending(false);
          refresh();
        });
    },
    [projectId, client, refresh],
  );

  const handlers: Record<SyncAction, () => void> = useMemo(
    () => ({
      pull: () => {
        if (view.link === null || syncFiles(view).length === 0) return;
        setReview(view);
        setReviewOpen(true);
      },
      get: () => {
        if (view.link === null) return;
        const conflicts = getConflicts(view);
        if (conflicts.length === 0) {
          submit("get", false, null);
          return;
        }
        confirm.ask({
          heading: SYNC_LABELS.getTitle(view.link.hostPath),
          body: getConfirmBody(view.link.hostPath, conflicts),
          confirmLabel: SYNC_LABELS.getForce,
          cancelLabel: SYNC_LABELS.cancel,
          onConfirm: () => submit("get", true, null),
        });
      },
      revert: () => {
        const snapshot = revertible(view);
        if (snapshot === null) return;
        confirm.ask({
          heading: SYNC_LABELS.revertTitle(snapshot.id),
          body: revertBody(snapshot),
          confirmLabel: SYNC_LABELS.revertConfirm,
          cancelLabel: SYNC_LABELS.cancel,
          onConfirm: () => submit("revert", false, null),
        });
      },
      discard: () => {
        const paths = discardable(view).map((change) => change.path);
        if (paths.length === 0) return;
        confirm.ask({
          heading: SYNC_LABELS.discardTitle(plural(paths.length)),
          body: discardBody(view, paths),
          confirmLabel: SYNC_LABELS.discardConfirm,
          cancelLabel: SYNC_LABELS.cancel,
          onConfirm: () => discard(paths),
        });
      },
    }),
    [view, submit, discard, confirm],
  );

  const buttons = useMemo(() => {
    const blockers = syncBlockers(view, busy);
    const waiting = syncWaiting(view);
    return SYNC_ACTIONS.map((id): SyncActionButton => {
      const reason = blockers[id];
      const disabled = projectId === null || reason !== null || pending;
      const base = SYNC_BUTTONS[id];
      const attention = !disabled && waiting[id] && base.variant === "secondary";
      return {
        id,
        label: LABELS[id],
        icon: base.icon,
        variant: attention ? "attention" : base.variant,
        disabled,
        tooltip: reason ?? SYNC_HINTS[id],
        onClick: handlers[id],
      };
    });
  }, [view, busy, projectId, pending, handlers]);

  const cancelRequest = useCallback(
    (request: SyncRequest) => {
      client?.cancelSyncRequest(request.id).then(refresh, (error: unknown) => report(error));
    },
    [client, refresh, report],
  );

  return {
    buttons,
    confirm,
    review,
    reviewOpen,
    closeReview: useCallback(() => setReviewOpen(false), []),
    clearReview: useCallback(() => setReview(null), []),
    confirmReview: useCallback((force: boolean, paths: string[]) => submit("pull", force, paths), [submit]),
    result,
    dismissResult: useCallback(() => setResult(null), []),
    cancelRequest,
  };
}
