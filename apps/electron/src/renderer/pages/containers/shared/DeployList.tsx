import type { HostDeploy } from "../../../../shared/contracts/containers";
import { KeyedList } from "../../../components/KeyedList";
import { useNow } from "../../../features/agents/hooks/use-now";
import { useOpenExternal } from "../../../features/containers/hooks/use-open-external";
import { useDeployActions, usePendingDeploys } from "../../../features/containers/hooks/use-deploy-actions";
import { DeployRow } from "./DeployRow";

export interface DeployListProps {
  deploys: readonly HostDeploy[];
  label: string;
}

export function DeployList({ deploys, label }: DeployListProps) {
  const { approve, reject } = useDeployActions();
  const pending = usePendingDeploys();
  const open = useOpenExternal();
  const now = useNow();
  return (
    <KeyedList
      divided
      label={label}
      items={deploys}
      getKey={(deploy) => deploy.id}
      renderItem={(deploy) => <DeployRow deploy={deploy} now={now} busy={pending.has(deploy.id)} onApprove={approve} onReject={reject} onOpenUrl={open} />}
    />
  );
}
