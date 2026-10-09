import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { HostPinDialog } from "../../../components/HostPinDialog";
import { IconButton } from "../../../components/IconButton";
import { ButtonRow, ExpanderRow, SettingsGroup, SwitchRow } from "../../../components/PreferenceRows";
import { PREFERENCES_TOAST_SCOPE } from "../constants";
import { PairPhoneDialog } from "../shared/PairPhoneDialog";
import { PreferencesPage } from "../shared/PreferencesPage";
import { HostLog } from "./HostLog";
import { HOST_SHELL_LABELS as L } from "./labels";
import { logText, pinButtonLabel, pinSubtitle, serveChecked, serveLocked, serveSubtitle } from "./model";
import { useHostDialogs } from "./use-host-dialogs";
import { useHostShell } from "./use-host-shell";

export default function HostShellPreferences() {
  const host = useHostShell();
  const dialogs = useHostDialogs();
  const state = host.state;
  const status = state?.status ?? "stopped";
  const pairing = state?.pairing ?? null;

  return (
    <PreferencesPage>
      <SettingsGroup
        title={L.server.title}
        description={L.server.description}
        headerSuffix={<IconButton icon="refresh" label={L.refresh} disabled={host.busy} onClick={host.refresh} />}
      >
        <SwitchRow
          title={L.serve.title}
          subtitle={state ? serveSubtitle(state) : undefined}
          checked={serveChecked(status)}
          disabled={!state || serveLocked(status) || host.busy}
          onChange={host.setServe}
        />
        <SwitchRow
          title={L.autostart.title}
          subtitle={L.autostart.subtitle}
          checked={state?.autostart ?? false}
          disabled={!state}
          onChange={host.setAutostart}
        />
      </SettingsGroup>
      <SettingsGroup title={L.security.title}>
        <ButtonRow title={L.pin.title} subtitle={pinSubtitle(pairing)} label={pinButtonLabel(pairing)} onActivate={dialogs.openPin} />
        <ButtonRow title={L.token.title} subtitle={L.token.subtitle} label={L.token.rotate} onActivate={dialogs.openRotate} />
      </SettingsGroup>
      <SettingsGroup title={L.pairing.title}>
        <ButtonRow title={L.pairing.pair} subtitle={L.pairing.pairSubtitle} label={L.pairing.showQr} onActivate={dialogs.openPair} />
        <ExpanderRow title={L.log.title}>
          <HostLog text={logText(state?.log ?? [])} />
        </ExpanderRow>
      </SettingsGroup>
      <HostPinDialog open={dialogs.dialog === "pin"} onSave={host.savePin} onClose={dialogs.close} toastScope={PREFERENCES_TOAST_SCOPE} />
      <ConfirmDialog
        open={dialogs.dialog === "rotate"}
        heading={L.rotate.heading}
        body={L.rotate.body}
        confirmLabel={L.rotate.confirm}
        cancelLabel={L.rotate.cancel}
        onConfirm={host.rotateToken}
        onClose={dialogs.close}
      />
      <PairPhoneDialog open={dialogs.dialog === "pair"} target="host" onClose={dialogs.close} />
    </PreferencesPage>
  );
}
