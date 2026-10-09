import { ActionButton } from "../../../components/ActionButton";
import { IconButton } from "../../../components/IconButton";
import { EntryRow, PreferenceRow, SettingsActions, SettingsGroup } from "../../../components/PreferenceRows";
import { StatusBadge } from "../../../components/StatusBadge";
import { CONTAINERS_URLS } from "../../../features/containers/constants";
import { useCloudflareToken } from "../../../features/containers/hooks/use-cloudflare-token";
import { useOpenExternal } from "../../../features/containers/hooks/use-open-external";
import { DOMAINS_LABELS } from "../../../features/containers/labels";
import { cloudflareBadge, cloudflareSummary } from "../../../features/containers/model";

export function CloudflareGroup() {
  const L = DOMAINS_LABELS.cloudflare;
  const cf = useCloudflareToken();
  const open = useOpenExternal();
  const connected = cf.cloudflare?.connected ?? false;
  const badge = cloudflareBadge(cf.cloudflare);
  const zones = cf.cloudflare?.zones.map((zone) => zone.name) ?? [];
  return (
    <SettingsGroup
      title={L.title}
      description={L.description}
      headerSuffix={<IconButton icon="refresh" label={DOMAINS_LABELS.refresh} disabled={cf.checking} onClick={cf.refresh} />}
      actions={
        <SettingsActions>
          {connected ? (
            <ActionButton variant="destructive" label={L.disconnect} busy={cf.disconnecting} disabled={cf.disconnecting} onClick={cf.disconnect} />
          ) : (
            <>
              <ActionButton icon="external" label={L.createToken} onClick={() => open(CONTAINERS_URLS.cloudflareTokens)} />
              <ActionButton variant="primary" label={L.connect} busy={cf.connecting} disabled={!cf.canConnect} onClick={cf.connect} />
            </>
          )}
        </SettingsActions>
      }
    >
      <PreferenceRow title={L.status} subtitle={cloudflareSummary(cf.cloudflare)} suffix={<StatusBadge label={badge.label} tone={badge.tone} live={connected} />} />
      {connected ? (
        <PreferenceRow title={L.zones} subtitle={zones.length > 0 ? L.zoneList(zones) : L.noZones} selectable />
      ) : (
        <EntryRow
          title={L.token}
          subtitle={L.permissions}
          password
          placeholder={L.tokenPlaceholder}
          value={cf.token}
          onChange={cf.setToken}
          onActivate={cf.connect}
        />
      )}
    </SettingsGroup>
  );
}
