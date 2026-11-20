import { ActionButton } from "../../../components/ActionButton";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { IconButton } from "../../../components/IconButton";
import { ButtonRow, PreferenceRow, SettingsActions, SettingsGroup } from "../../../components/PreferenceRows";
import { SignInRows } from "../../../features/account/SignInRows";
import { PreferencesPage } from "../shared/PreferencesPage";
import { PropertyList } from "../shared/PropertyList";
import { ACCOUNT_LABELS as L } from "./labels";
import { accountRows, deviceName, deviceSubtitle } from "./model";
import { useAccount } from "./use-account";

export default function AccountPreferences() {
  const view = useAccount();
  const { state, dialog } = view;
  return (
    <PreferencesPage>
      {state?.account ? (
        <>
          <SettingsGroup
            title={L.account.title}
            description={L.account.description}
            headerSuffix={<IconButton icon="refresh" label={L.refresh} disabled={view.busy} onClick={view.refresh} />}
            actions={
              <SettingsActions>
                <ActionButton icon="logout" label={L.account.signOut} busy={view.busy} disabled={view.busy} onClick={view.signOut} />
              </SettingsActions>
            }
          >
            <PropertyList items={accountRows(state)} />
          </SettingsGroup>
          <SettingsGroup title={L.devices.title} description={L.devices.description}>
            {view.devicesError ? <PreferenceRow title={view.devicesError} /> : null}
            {!view.devicesError && !view.devicesLoading && view.devices.length === 0 ? <PreferenceRow title={L.devices.empty} /> : null}
            {view.devices.map((device) => (
              <PreferenceRow
                key={device.id}
                title={deviceName(device)}
                subtitle={deviceSubtitle(device)}
                suffix={<ActionButton size="sm" variant="destructive" label={L.devices.remove} disabled={view.busy} onClick={() => view.askRemove(device)} />}
              />
            ))}
          </SettingsGroup>
          <SettingsGroup title={L.danger.title}>
            <ButtonRow title={L.danger.title} subtitle={L.danger.subtitle} label={L.danger.action} variant="destructive" disabled={view.busy} onActivate={view.askDelete} />
          </SettingsGroup>
        </>
      ) : (
        <SettingsGroup title={L.account.title} description={state?.error ?? L.account.signedOutDescription}>
          <SignInRows form={view.signIn} withName disabled={!state} />
        </SettingsGroup>
      )}
      <ConfirmDialog
        open={dialog !== null}
        destructive
        heading={dialog?.kind === "remove" ? L.devices.confirmHeading(deviceName(dialog.device)) : L.danger.heading}
        body={dialog?.kind === "remove" ? L.devices.confirmBody : L.danger.body}
        confirmLabel={dialog?.kind === "remove" ? L.devices.remove : L.danger.confirm}
        cancelLabel={L.cancel}
        onConfirm={view.confirm}
        onClose={view.closeDialog}
      />
    </PreferencesPage>
  );
}
