import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Notice } from "../../../components/Notice";
import { Crossfade } from "../../../components/Presence";
import { AccelGroup } from "../../../onboarding/android/components/AccelGroup";
import { AvdFormGroup } from "../../../onboarding/android/components/AvdFormGroup";
import { DownloadQueue } from "../../../onboarding/android/components/DownloadQueue";
import { LicenseDialog } from "../../../onboarding/android/components/LicenseDialog";
import { PackageTable } from "../../../onboarding/android/components/PackageTable";
import { SdkLocationGroup } from "../../../onboarding/android/components/SdkLocationGroup";
import { SummaryGroup } from "../../../onboarding/android/components/SummaryGroup";
import { ANDROID_LABELS } from "../../../onboarding/android/labels";
import { PreferencesPage } from "../shared/PreferencesPage";
import { DevicesGroup } from "./DevicesGroup";
import { useAndroidSettings } from "./hooks/use-android-settings";
import { useDeviceActions } from "./hooks/use-device-actions";
import { InstallActions } from "./InstallActions";
import { ANDROID_SETTINGS_LABELS as L } from "./labels";
import { NewDeviceGroup } from "./NewDeviceGroup";
import styles from "./AndroidPreferences.module.css";

export default function AndroidPreferences() {
  const model = useAndroidSettings();
  const devices = useDeviceActions(model.sdkRoot);
  const { support, sources, details, flow } = model;

  if (support && !support.supported) {
    return (
      <PreferencesPage>
        <Notice tone="warning" title={ANDROID_LABELS.unsupportedTitle} message={support.reason} />
      </PreferencesPage>
    );
  }

  const locked = model.installing || flow.busy;
  return (
    <PreferencesPage>
      <DevicesGroup
        avds={details.avds}
        emulator={sources.emulator}
        disabled={locked}
        onRefresh={devices.refresh}
        onStart={devices.start}
        onStop={devices.stop}
        onDelete={devices.askDelete}
      />
      <AccelGroup result={details.accel} loading={details.accelLoading} onRecheck={details.recheckAccel} onOpenDocs={model.openAccelDocs} disabled={locked} />
      <Crossfade id={model.installing ? "queue" : "edit"} layerClassName={styles.stack}>
        {model.installing ? (
          <DownloadQueue items={model.queue} log={sources.log} />
        ) : (
          <>
            <SdkLocationGroup choices={model.sdk.choices} value={model.sdk.value} onSelect={model.sdk.select} disabled={locked} />
            <PackageTable
              tools={model.table.tools}
              images={model.table.images}
              selected={model.table.selected}
              onToggle={model.table.toggle}
              onToggleAll={model.table.toggleAll}
              loading={sources.catalogLoading}
              error={sources.catalogError}
              onRetry={sources.retryCatalog}
              disabled={locked}
            />
            <NewDeviceGroup checked={model.wantsDevice} disabled={locked || model.table.selected.size === 0} onChange={model.setCreateDevice} />
            {model.wantsDevice ? (
              <AvdFormGroup
                avd={model.avd}
                imageOptions={model.imageOptions}
                maxCores={model.maxCores}
                existingCount={details.avds.length}
                emulatorError={model.emulatorError}
                disabled={locked}
              />
            ) : null}
            {sources.catalog ? <SummaryGroup summary={model.summary} /> : null}
          </>
        )}
      </Crossfade>
      <InstallActions stage={flow.stage} download={model.summary.download} canInstall={model.canInstall} onInstall={model.startInstall} onCancel={flow.cancel} />
      <LicenseDialog
        open={flow.stage.kind === "licenses"}
        pending={flow.stage.kind === "licenses" ? flow.stage.pending : []}
        texts={sources.catalog?.licenses ?? {}}
        busy={flow.busy}
        onAccept={flow.acceptLicenses}
        onCancel={flow.cancel}
      />
      <ConfirmDialog
        open={devices.deleting !== null}
        heading={L.deleteConfirm.heading(devices.deleting?.name ?? "")}
        body={L.deleteConfirm.body}
        confirmLabel={L.deleteConfirm.confirm}
        cancelLabel={L.deleteConfirm.cancel}
        onConfirm={devices.confirmDelete}
        onClose={devices.closeDelete}
      />
    </PreferencesPage>
  );
}
