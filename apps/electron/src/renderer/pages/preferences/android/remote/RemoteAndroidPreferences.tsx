import { useState } from "react";
import { EmptyState } from "../../../../components/EmptyState";
import { Notice } from "../../../../components/Notice";
import { useHostGate } from "../../../../features/host-shell/hooks/use-host-gate";
import { HostUnlock } from "../../../shell/HostUnlock";
import { PreferencesPage } from "../../shared/PreferencesPage";
import { usePreferencesToast } from "../../shared/use-preferences-toast";
import { REMOTE_ANDROID_LABELS as L } from "./labels";
import { pickChanged, pickedPath, savedPick, toolchainMissing, type ToolchainKind, type ToolchainPick } from "./model";
import { ToolchainGroup } from "./ToolchainGroup";
import { useHostToolchain } from "./use-host-toolchain";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const FIELDS = { android: "androidSdkRoot", java: "javaHome" } as const;

/** Preferences → Android while the active machine's sandbox runs on another computer: that host's SDK and JDK. */
export default function RemoteAndroidPreferences() {
  const host = useHostGate();
  const url = host.state?.pairing?.url ?? null;
  const name = host.state?.pairing?.name || L.fallbackHost;
  const model = useHostToolchain(host.client, url);
  const toast = usePreferencesToast();
  const [picks, setPicks] = useState<Partial<Record<ToolchainKind, ToolchainPick>>>({});
  const { gate } = host;
  const toolchain = model.toolchain;

  if (gate) {
    return (
      <PreferencesPage>
        <EmptyState
          icon={gate.icon}
          loading={gate.loading}
          title={gate.title}
          message={gate.message}
          actionLabel={gate.actionLabel ?? undefined}
          onAction={gate.action ? host.onAction : undefined}
          secondaryLabel={gate.secondaryLabel ?? undefined}
          onSecondary={gate.secondary ? host.onSecondary : undefined}
        />
        <HostUnlock dialog={host.unlockDialog} />
      </PreferencesPage>
    );
  }

  const save = (kind: ToolchainKind, pick: ToolchainPick) => {
    const path = pickedPath(pick);
    if (path === undefined) return;
    model
      .save({ [FIELDS[kind]]: path })
      .then(() => {
        setPicks((current) => ({ ...current, [kind]: undefined }));
        toast(L.saved(L[kind].title));
      })
      .catch((error: unknown) => toast(L.saveFailed(message(error)), true));
  };

  const group = (kind: ToolchainKind) => {
    if (!toolchain) return null;
    const section = toolchain[kind];
    const pick = picks[kind] ?? savedPick(section);
    const details =
      kind === "android"
        ? [
            { title: L.android.adb, value: toolchain.android.adb },
            { title: L.android.emulator, value: toolchain.android.emulator },
          ]
        : [];
    return (
      <>
        {toolchainMissing(section) ? <Notice tone="warning" title={L[kind].missingTitle} message={L[kind].missing} /> : null}
        <ToolchainGroup
          kind={kind}
          section={section}
          pick={pick}
          onPick={(next) => setPicks((current) => ({ ...current, [kind]: next }))}
          canSave={pickChanged(section, pick)}
          saving={model.saving}
          disabled={model.saving}
          onSave={() => save(kind, pick)}
          details={details}
        />
      </>
    );
  };

  return (
    <PreferencesPage>
      <Notice title={L.intro.title(name)} message={L.intro.message} actionLabel={L.refresh} onAction={model.refresh} />
      {model.error ? <Notice tone="danger" message={L.loadFailed(model.error)} actionLabel={L.retry} onAction={model.refresh} /> : null}
      {model.loading ? <EmptyState icon="smartphone" loading title={L.loading} /> : null}
      {group("android")}
      {group("java")}
      <HostUnlock dialog={host.unlockDialog} />
    </PreferencesPage>
  );
}
