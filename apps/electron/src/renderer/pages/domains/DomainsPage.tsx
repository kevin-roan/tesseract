import { useMemo } from "react";
import { ActionButton } from "../../components/ActionButton";
import { ListGroup } from "../../components/GroupBand";
import { Notice } from "../../components/Notice";
import { PageBody } from "../../components/PageBody";
import { useDomainsPage } from "../../features/containers/hooks/use-domains-page";
import { DOMAINS_LABELS as L } from "../../features/containers/labels";
import { usePageHeader } from "../../shell/header-store";
import { AddRouteDialog } from "../containers/shared/AddRouteDialog";
import { CloudflareGroup } from "../containers/shared/CloudflareGroup";
import { RouteList } from "../containers/shared/RouteList";
import { HeaderActions } from "../projects/HeaderActions";

export default function DomainsPage() {
  const page = useDomainsPage();
  const { reload, openAdd } = page;
  const actions = useMemo(
    () => (
      <HeaderActions
        items={[
          { id: "refresh", icon: "refresh", label: L.refresh, onClick: reload },
          { id: "add", icon: "add", label: L.routes.add, onClick: openAdd },
        ]}
      />
    ),
    [reload, openAdd],
  );
  usePageHeader({ title: L.title, actions });
  return (
    <PageBody label={L.title}>
      <Notice tone="info" icon="info" title={L.security.title} message={L.security.message} />
      <CloudflareGroup />
      <ListGroup
        icon="globe"
        title={L.routes.title}
        subtitle={L.routes.subtitle}
        count={page.routes.length}
        actionLabel={L.routes.add}
        onAction={page.connected ? openAdd : undefined}
        trailing={
          page.connected ? (
            <ActionButton size="sm" variant="flat" icon="sync" label={L.resync} busy={page.syncing} disabled={page.syncing} onClick={page.resync} />
          ) : null
        }
        loading={page.loading}
        empty={page.routes.length === 0}
        emptyLabel={page.emptyLabel}
      >
        <RouteList routes={page.routes} label={L.routes.title} showContainer />
      </ListGroup>
      <AddRouteDialog open={page.addOpen} onClose={page.closeAdd} />
    </PageBody>
  );
}
