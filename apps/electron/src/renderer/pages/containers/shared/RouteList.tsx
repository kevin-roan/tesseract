import type { DomainRoute } from "../../../../shared/contracts/containers";
import { copyText } from "../../../components/CopyButton";
import { KeyedList } from "../../../components/KeyedList";
import { RecordRow } from "../../../components/RecordRow";
import { useOpenExternal } from "../../../features/containers/hooks/use-open-external";
import { useRouteActions } from "../../../features/containers/hooks/use-route-actions";
import { routeRow } from "./rows";

export interface RouteListProps {
  routes: readonly DomainRoute[];
  label: string;
  showContainer?: boolean;
}

export function RouteList({ routes, label, showContainer = false }: RouteListProps) {
  const actions = useRouteActions();
  const open = useOpenExternal();
  const handlers = { open, copy: (url: string) => void copyText(url), remove: actions.remove };
  return (
    <KeyedList
      divided
      label={label}
      items={routes}
      getKey={(route) => route.id}
      renderItem={(route) => <RecordRow {...routeRow(route, { showContainer, removing: actions.removingId === route.id }, handlers)} />}
    />
  );
}
