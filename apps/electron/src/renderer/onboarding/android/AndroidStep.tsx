import { motion } from "motion/react";
import { Notice } from "../../components/Notice";
import { fade } from "../../theme/motion";
import { StepHero } from "../shared/StepHero";
import { AccelGroup } from "./components/AccelGroup";
import { AndroidFooter } from "./components/AndroidFooter";
import { AvdFormGroup } from "./components/AvdFormGroup";
import { DoneGroup } from "./components/DoneGroup";
import { DownloadQueue } from "./components/DownloadQueue";
import { LicenseDialog } from "./components/LicenseDialog";
import { PackageTable } from "./components/PackageTable";
import { SdkLocationGroup } from "./components/SdkLocationGroup";
import { SummaryGroup } from "./components/SummaryGroup";
import { useAndroidStep } from "./hooks/use-android-step";
import { useDoneDetails } from "./hooks/use-done-details";
import { ANDROID_LABELS } from "./labels";
import { stepView } from "./model";
import styles from "./AndroidStep.module.css";

export default function AndroidStep() {
  const step = useAndroidStep();
  const { mode, phase, actions, navigation } = step;
  const view = stepView(mode);
  const done = useDoneDetails(step);
  const locked = view !== "edit" || actions.busy;
  const accel = phase.kind === "accel" && phase.result ? phase.result : step.details.accel;

  return (
    <>
      <StepHero icon="smartphone" title={ANDROID_LABELS.hero.title} description={ANDROID_LABELS.hero.description} />
      <motion.div key={view} className={styles.view} variants={fade} initial="initial" animate="animate">
          {view === "unsupported" && phase.kind === "unsupported" ? (
            <Notice tone="warning" title={ANDROID_LABELS.unsupportedTitle} message={phase.reason} />
          ) : null}
          {view === "done" && done ? <DoneGroup {...done} /> : null}
          {view === "edit" || view === "queue" ? (
            <AccelGroup
              result={accel}
              loading={step.details.accelLoading}
              onRecheck={step.details.recheckAccel}
              onOpenDocs={actions.openAccelDocs}
              disabled={view === "queue"}
            />
          ) : null}
          {view === "queue" ? <DownloadQueue items={step.queue} log={step.log} /> : null}
          {view === "edit" ? (
            <>
              {phase.kind === "failed" ? <Notice tone="danger" title={ANDROID_LABELS.failed} message={phase.message} /> : null}
              {phase.kind === "cancelled" ? <Notice tone="neutral" message={ANDROID_LABELS.cancelled} /> : null}
              {actions.error ? <Notice tone="danger" message={actions.error} /> : null}
              <SdkLocationGroup choices={step.sdk.choices} value={step.sdk.value} onSelect={step.sdk.select} disabled={locked} />
              <PackageTable
                tools={step.table.tools}
                images={step.table.images}
                selected={step.table.selected}
                onToggle={step.table.toggle}
                onToggleAll={step.table.toggleAll}
                loading={step.sources.catalogLoading}
                error={step.sources.catalogError}
                onRetry={step.sources.retryCatalog}
                disabled={locked}
              />
              <AvdFormGroup
                avd={step.avd}
                imageOptions={step.imageOptions}
                maxCores={step.maxCores}
                existingCount={step.details.avds.length}
                emulatorError={step.emulatorError}
                disabled={locked}
              />
              {step.sources.catalog ? <SummaryGroup summary={step.summary} /> : null}
            </>
          ) : null}
      </motion.div>
      <LicenseDialog
        open={phase.kind === "licenses"}
        pending={phase.kind === "licenses" ? phase.pending : []}
        texts={step.sources.catalog?.licenses ?? {}}
        busy={actions.busy}
        onAccept={actions.acceptLicenses}
        onCancel={actions.cancel}
      />
      <AndroidFooter
        mode={mode}
        canInstall={step.canInstall}
        busy={actions.busy}
        existingAvd={step.existingAvd}
        onBack={navigation.back}
        onSkip={navigation.skip}
        onInstall={step.startInstall}
        onUseExisting={step.useExisting}
        onCancel={actions.cancel}
        onContinue={navigation.next}
      />
    </>
  );
}
