import { ActionButton } from "../../../components/ActionButton";
import { IconButton } from "../../../components/IconButton";
import { SettingsActions, SettingsGroup } from "../../../components/PreferenceRows";
import { Spinner } from "../../../components/Spinner";
import { CheckRow } from "../../../onboarding/shell";
import { CONTAINERS_SETTINGS_LABELS } from "./labels";
import { useContainersChecks } from "./use-containers-checks";

export function ChecksGroup() {
  const L = CONTAINERS_SETTINGS_LABELS.checks;
  const checks = useContainersChecks();
  return (
    <SettingsGroup
      title={L.title}
      description={L.description}
      headerSuffix={
        checks.checking ? (
          <Spinner size={16} label={L.refresh} />
        ) : (
          <IconButton icon="refresh" label={L.refresh} onClick={checks.refresh} />
        )
      }
      actions={
        checks.build.building ? (
          <SettingsActions>
            <ActionButton size="dialog" label={L.cancelBuild} busy={checks.build.cancelling} disabled={checks.build.cancelling} onClick={checks.build.cancel} />
          </SettingsActions>
        ) : null
      }
    >
      {checks.rows.map((row, index) => (
        <CheckRow
          key={row.id}
          index={index}
          title={row.title}
          subtitle={row.subtitle}
          status={row.status}
          action={row.action ? { label: L.actions[row.action], primary: row.action === "build-image", onClick: () => checks.run(row.action!) } : null}
        />
      ))}
    </SettingsGroup>
  );
}
