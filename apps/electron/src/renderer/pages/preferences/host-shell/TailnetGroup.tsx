import { ButtonRow, PreferenceRow, SettingsGroup } from "../../../components/PreferenceRows";
import { RadioRows } from "../../../components/RadioRows";
import { ACCOUNT_SECTION } from "../../../features/account/constants";
import { usePreferencesRoute } from "../../../app/navigation";
import { HOST_SHELL_LABELS } from "./labels";
import { tailnetStatusText } from "./model";
import { TAILNET_MODE_CHOICES, useHostTailnet } from "./use-host-tailnet";

const L = HOST_SHELL_LABELS.tailnet;

/** Host shell and host workspace on the Tesseract Network (bundled tesseract-tailnet). */
export function TailnetGroup() {
  const tailnet = useHostTailnet();
  const { openPreferences } = usePreferencesRoute();
  const state = tailnet.state;
  return (
    <>
      <SettingsGroup title={L.title} description={L.description} listRole="radiogroup">
        <RadioRows choices={TAILNET_MODE_CHOICES} value={state?.mode ?? null} busy={!state || tailnet.busy} onSelect={tailnet.setMode} />
      </SettingsGroup>
      <SettingsGroup>
        {state?.status === "signed-out" ? (
          <ButtonRow title={L.statusTitle} subtitle={tailnetStatusText(state)} label={L.openAccount} onActivate={() => openPreferences(ACCOUNT_SECTION)} />
        ) : state?.enabled ? (
          <ButtonRow title={L.statusTitle} subtitle={tailnetStatusText(state)} label={L.restart} busy={tailnet.busy} disabled={tailnet.busy} onActivate={tailnet.restart} />
        ) : state ? (
          <PreferenceRow title={L.statusTitle} subtitle={tailnetStatusText(state)} />
        ) : null}
      </SettingsGroup>
    </>
  );
}
