import type { DockerReport } from "../../../../shared/contracts/docker";
import { IconButton } from "../../../components/IconButton";
import { Notice } from "../../../components/Notice";
import { PreferenceRow, SettingsGroup } from "../../../components/PreferenceRows";
import { StatusBadge } from "../../../components/StatusBadge";
import { SANDBOX_SETTINGS_LABELS } from "./labels";
import { dockerBadge, dockerReady, dockerSubtitle } from "./model";

export interface DockerGroupProps {
  report: DockerReport | null;
  checking: boolean;
  onRecheck(): void;
  onOpenSetup(): void;
}

export function DockerGroup({ report, checking, onRecheck, onOpenSetup }: DockerGroupProps) {
  const L = SANDBOX_SETTINGS_LABELS;
  const badge = checking ? dockerBadge(null) : dockerBadge(report);
  return (
    <SettingsGroup
      title={L.docker.title}
      description={L.docker.description}
      headerSuffix={<IconButton icon="refresh" label={L.refresh} disabled={checking} onClick={onRecheck} />}
      actions={
        report && !dockerReady(report) ? <Notice tone="warning" message={L.docker.fix} actionLabel={L.docker.openSetup} onAction={onOpenSetup} /> : null
      }
    >
      <PreferenceRow
        title={L.docker.engine}
        subtitle={dockerSubtitle(report)}
        selectable
        suffix={<StatusBadge label={badge.label} tone={badge.tone} live={badge.tone === "success"} />}
      />
    </SettingsGroup>
  );
}
