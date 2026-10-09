import { ActionButton } from "../../../components/ActionButton";
import { CodeBlock } from "../../../components/CodeBlock";
import { EntryRow, PreferenceRow, SettingsActions, SettingsGroup } from "../../../components/PreferenceRows";
import { StatusBadge } from "../../../components/StatusBadge";
import { CONTAINERS_URLS, TAILSCALE_ACL_SNIPPET } from "../../../features/containers/constants";
import { useOpenExternal } from "../../../features/containers/hooks/use-open-external";
import { useTailscaleKey } from "../../../features/containers/hooks/use-tailscale-key";
import { TAILSCALE_LABELS as L } from "../../../features/containers/labels";
import { CONTAINERS_SETTINGS_LABELS } from "./labels";
import styles from "./ContainersPreferences.module.css";

export function TailscaleGroup() {
  const key = useTailscaleKey();
  const open = useOpenExternal();
  return (
    <>
      <SettingsGroup
        title={L.title}
        description={L.description}
        actions={
          <SettingsActions>
            <ActionButton icon="external" label={L.openKeys} onClick={() => open(CONTAINERS_URLS.tailscaleKeys)} />
            {key.configured ? (
              <ActionButton variant="destructive" label={L.clear} busy={key.clearing} disabled={key.clearing} onClick={key.clear} />
            ) : null}
            <ActionButton variant="primary" label={L.save} busy={key.saving} disabled={!key.canSave} onClick={key.submit} />
          </SettingsActions>
        }
      >
        <PreferenceRow
          title={L.authKey}
          subtitle={key.configured ? L.configured : L.missing}
          suffix={<StatusBadge label={key.configured ? L.badge.saved : L.badge.missing} tone={key.configured ? "success" : "warning"} />}
        />
        <EntryRow title={L.authKey} subtitle={L.help} password placeholder={L.authKeyPlaceholder} value={key.authKey} onChange={key.setAuthKey} onActivate={key.submit} />
        <EntryRow title={L.tags} subtitle={L.tagsHint} mono value={key.tags} onChange={key.setTags} onActivate={key.submit} />
      </SettingsGroup>
      <SettingsGroup
        title={CONTAINERS_SETTINGS_LABELS.policy.title}
        description={L.acl}
        actions={
          <>
            <CodeBlock code={TAILSCALE_ACL_SNIPPET} language="json" className={styles.snippet} />
            <SettingsActions>
              <ActionButton icon="external" label={L.openAcl} onClick={() => open(CONTAINERS_URLS.tailscaleAcl)} />
            </SettingsActions>
          </>
        }
      />
    </>
  );
}
