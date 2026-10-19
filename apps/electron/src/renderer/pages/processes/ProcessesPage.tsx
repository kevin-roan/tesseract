import { useMemo } from "react";
import { EmptyState } from "../../components/EmptyState";
import { Notice } from "../../components/Notice";
import { PageBody } from "../../components/PageBody";
import { EMPTY_ICON, ERROR_ICON } from "../../features/processes/constants";
import { useProcessesPage, type ProcessesPageModel } from "../../features/processes/hooks/use-processes-page";
import { CONNECTION_ACTION_LABELS, PROCESSES_LABELS as L } from "../../features/processes/labels";
import { usePageHeader } from "../../shell/header-store";
import { HeaderActions } from "../projects/HeaderActions";
import { ForceKillDialog } from "./ForceKillDialog";
import { ProcessGroup } from "./ProcessGroup";
import styles from "./ProcessesPage.module.css";

function ProcessesState({ page }: { page: ProcessesPageModel }) {
  const { offline } = page;
  if (page.status === "connection" && offline) {
    return (
      <EmptyState
        title={offline.title}
        message={offline.message}
        loading={offline.loading}
        icon={offline.icon}
        actionLabel={offline.action ? CONNECTION_ACTION_LABELS[offline.action] : undefined}
        onAction={page.runConnectionAction}
      />
    );
  }
  if (page.status === "error") return <EmptyState title={L.errorTitle} message={page.error} icon={ERROR_ICON} actionLabel={L.retry} onAction={page.refresh} />;
  if (page.status === "loading") return <EmptyState title={L.loading} loading icon={null} />;
  return <EmptyState title={L.empty.title} message={L.empty.message} icon={EMPTY_ICON} />;
}

export default function ProcessesPage() {
  const page = useProcessesPage();
  const { refresh, stop, requestKill } = page;
  const actions = useMemo(() => <HeaderActions items={[{ id: "refresh", icon: "refresh", label: L.refresh, onClick: refresh }]} />, [refresh]);
  usePageHeader({ title: L.title, actions });
  const handlers = useMemo(() => ({ stop, kill: requestKill }), [stop, requestKill]);
  return (
    <>
      {page.status === "content" ? (
        <PageBody label={L.title}>
          {page.notice ? (
            <Notice
              tone="warning"
              icon={page.notice.icon}
              title={page.notice.title}
              message={page.notice.message}
              actionLabel={page.notice.action ? CONNECTION_ACTION_LABELS[page.notice.action] : undefined}
              onAction={page.notice.action ? page.runConnectionAction : undefined}
            />
          ) : null}
          {page.groups.map((group) => (
            <ProcessGroup key={group.id} group={group} pending={page.pending} handlers={handlers} />
          ))}
        </PageBody>
      ) : (
        <div className={styles.state}>
          <ProcessesState page={page} />
        </div>
      )}
      <ForceKillDialog target={page.killTarget} onConfirm={page.kill} onClose={page.closeKill} />
    </>
  );
}
