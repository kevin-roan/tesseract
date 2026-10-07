import { ActionButton } from "../../../components/ActionButton";
import { PreferenceRow, SettingsGroup } from "../../../components/PreferenceRows";
import { StatusBadge } from "../../../components/StatusBadge";
import { CommandBlock } from "../../../onboarding/shell";
import { ABOUT_LABELS } from "./labels";
import type { CliView } from "./model";

export function CliGroup({ view, installing, onInstall }: { view: CliView; installing: boolean; onInstall(): void }) {
  const C = ABOUT_LABELS.cli;
  return (
    <SettingsGroup title={C.title} description={C.description} actions={view.installed ? <CommandBlock command={C.usage} /> : null}>
      <PreferenceRow
        title={C.row}
        subtitle={view.subtitle}
        selectable={view.installed}
        suffix={
          view.installed ? (
            <StatusBadge label={C.installedBadge} tone="success" />
          ) : view.canInstall ? (
            <ActionButton size="dialog" variant="primary" icon="terminal" label={C.install} busy={installing} disabled={installing} onClick={onInstall} />
          ) : null
        }
      />
    </SettingsGroup>
  );
}
