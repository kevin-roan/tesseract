import { useState } from "react";
import type { HostDeploy } from "../../../../shared/contracts/containers";
import { ActionButton } from "../../../components/ActionButton";
import { CodeBlock } from "../../../components/CodeBlock";
import { Icon } from "../../../components/Icon";
import { KeyValueList } from "../../../components/KeyValueList";
import { Reveal } from "../../../components/Reveal";
import { StatusBadge } from "../../../components/StatusBadge";
import { Text } from "../../../components/Text";
import { DEPLOY_KIND_ICONS } from "../../../features/containers/constants";
import { DEPLOYS_LABELS as L } from "../../../features/containers/labels";
import { deployBadge, deployRequestView, deploySubtitle, isAwaitingApproval } from "../../../features/containers/model";
import styles from "./DeployRow.module.css";

export interface DeployRowProps {
  deploy: HostDeploy;
  now: number;
  busy?: boolean;
  onApprove?: (deploy: HostDeploy) => void;
  onReject?: (deploy: HostDeploy) => void;
  onOpenUrl?: (url: string) => void;
}

export function DeployRow({ deploy, now, busy = false, onApprove, onReject, onOpenUrl }: DeployRowProps) {
  const [logOpen, setLogOpen] = useState(false);
  const awaiting = isAwaitingApproval(deploy);
  const request = awaiting ? deployRequestView(deploy) : null;
  return (
    <article className={styles.deploy} data-awaiting={awaiting || undefined}>
      <div className={styles.head}>
        <Icon name={DEPLOY_KIND_ICONS[deploy.kind]} color="text-secondary" />
        <div className={styles.titles}>
          <Text variant="label">{deploy.app}</Text>
          <Text variant="caption" color="text-secondary">
            {deploySubtitle(deploy, now)}
          </Text>
        </div>
        <StatusBadge {...deployBadge(deploy.status)} />
      </div>
      {request ? (
        <div className={styles.request}>
          <Text variant="bodyStrong" color="warning">
            {request.title}
          </Text>
          <KeyValueList rows={request.entries} flat />
          <div className={styles.decision}>
            <ActionButton variant="primary" icon="check" label={request.approveLabel} busy={busy} disabled={busy || !onApprove} onClick={() => onApprove?.(deploy)} />
            <ActionButton variant="destructive" icon="close" label={L.reject} disabled={busy || !onReject} onClick={() => onReject?.(deploy)} />
          </div>
        </div>
      ) : null}
      {deploy.urls.length > 0 ? (
        <div className={styles.urls}>
          {deploy.urls.map((url) => (
            <ActionButton key={url} variant="link" size="sm" icon="external" label={url} tooltip={L.openUrl(url)} onClick={() => onOpenUrl?.(url)} />
          ))}
        </div>
      ) : null}
      {deploy.error ? (
        <Text variant="bodySmall" color="danger" wrap lines={null} selectable>
          {deploy.error}
        </Text>
      ) : null}
      <div>
        <ActionButton
          variant="flat"
          size="sm"
          icon={logOpen ? "caret-down" : "caret-right"}
          label={logOpen ? L.hideLog : L.showLog}
          aria-expanded={logOpen}
          onClick={() => setLogOpen((open) => !open)}
        />
      </div>
      <Reveal open={logOpen}>
        <CodeBlock code={deploy.log || L.logEmpty} />
      </Reveal>
    </article>
  );
}
