import { useMemo } from "react";
import { CodeBlock } from "../../../components/CodeBlock";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { ListGroup } from "../../../components/GroupBand";
import { KeyValueList } from "../../../components/KeyValueList";
import { LogPanel } from "../../../components/LogPanel";
import { Notice } from "../../../components/Notice";
import { PageBody } from "../../../components/PageBody";
import { Crossfade } from "../../../components/Presence";
import { Section } from "../../../components/Section";
import { TerminalPanel } from "../../../components/TerminalPanel";
import { CONTAINER_LOGS_MIN_HEIGHT } from "../../../features/containers/constants";
import { useContainerDetail } from "../../../features/containers/hooks/use-container-detail";
import { CONTAINERS_LABELS as L } from "../../../features/containers/labels";
import { usePageHeader } from "../../../shell/header-store";
import { HeaderActions } from "../../projects/HeaderActions";
import { AddRouteDialog } from "../shared/AddRouteDialog";
import { RouteList } from "../shared/RouteList";
import { StateView } from "../shared/StateView";
import { ContainerHeader } from "./ContainerHeader";
import styles from "../ContainersPage.module.css";

export interface ContainerDetailProps {
  name: string;
  onBack(): void;
  onSettings(): void;
}

export function ContainerDetail({ name, onBack, onSettings }: ContainerDetailProps) {
  const detail = useContainerDetail(name, { onBack, onSettings });
  const { container, reload, shell } = detail;
  const headerActions = useMemo(() => <HeaderActions items={[{ id: "refresh", icon: "refresh", label: L.refresh, onClick: reload }]} />, [reload]);
  usePageHeader({ parent: L.title, title: name, actions: headerActions, onBack });
  return (
    <Crossfade id={detail.state ? `state:${detail.state.title}` : "content"} className={styles.state}>
      {detail.state ? (
        <StateView state={detail.state} onAction={detail.onAction} />
      ) : container ? (
        <PageBody label={name}>
          <ContainerHeader
            container={container}
            busy={detail.busy}
            onStart={() => detail.actions.start(name)}
            onStop={() => detail.actions.stop(name)}
            onRestart={() => detail.actions.restart(name)}
            onDelete={detail.openRemove}
          />
          <Section title={L.detail.properties}>
            <KeyValueList rows={detail.properties} />
          </Section>
          <Section title={L.detail.ssh} subtitle={detail.ssh ? L.detail.sshHint : null}>
            {detail.ssh ? (
              <CodeBlock code={detail.ssh} language="bash" />
            ) : (
              <Notice message={L.detail.offTailnet} actionLabel={L.detail.openSettings} onAction={onSettings} />
            )}
          </Section>
          <TerminalPanel
            title={L.detail.shell}
            host={shell.host}
            background={shell.background}
            status={shell.view.status}
            action={shell.view.action ? { label: shell.view.action === "open" ? L.detail.openShell : L.detail.reopenShell, icon: "terminal", onClick: shell.open } : null}
            placeholder={shell.view.placeholder}
            closeLabel={L.detail.closeShell}
            onClose={shell.host ? shell.close : undefined}
          />
          <ListGroup
            icon="globe"
            title={L.detail.urls}
            subtitle={L.detail.urlsSubtitle}
            count={detail.routes.length}
            actionLabel={L.detail.addUrl}
            onAction={detail.openRoute}
            empty={detail.routes.length === 0}
            emptyLabel={L.detail.noUrls}
          >
            <RouteList routes={detail.routes} label={L.detail.urls} />
          </ListGroup>
          <LogPanel
            title={L.detail.logs}
            lines={detail.logs.lines}
            action={{ label: L.detail.refreshLogs, icon: "refresh", onClick: detail.logs.refresh }}
            emptyLabel={L.detail.logsEmpty}
            minHeight={CONTAINER_LOGS_MIN_HEIGHT}
          />
          <AddRouteDialog open={detail.routeOpen} container={name} onClose={detail.closeRoute} />
          <ConfirmDialog
            open={detail.removeOpen}
            heading={L.remove.heading(name)}
            body={L.remove.body(name, detail.routes.length)}
            confirmLabel={L.remove.confirm}
            cancelLabel={L.remove.cancel}
            onConfirm={detail.confirmRemove}
            onClose={detail.closeRemove}
          />
        </PageBody>
      ) : null}
    </Crossfade>
  );
}
