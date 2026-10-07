import { AnimatePresence } from "motion/react";
import type { OnboardingState } from "../../../shared/contracts/onboarding";
import { ONBOARDING_LABELS } from "../labels";
import { useOnboardingState } from "../shell";
import { StepHero } from "../shared/StepHero";
import { useSandboxStep } from "./hooks/use-sandbox-step";
import { SANDBOX_STEP_LABELS } from "./labels";
import { AdvancedSection } from "./sections/AdvancedSection";
import { BuildSection } from "./sections/BuildSection";
import { ExistingNotice } from "./sections/ExistingNotice";
import { ReachabilitySection } from "./sections/ReachabilitySection";
import { ResourcesSection } from "./sections/ResourcesSection";
import { SandboxFooter } from "./sections/SandboxFooter";
import { SourceSection } from "./sections/SourceSection";
import { ToolsSection } from "./sections/ToolsSection";
import styles from "./SandboxStep.module.css";

export default function SandboxStep() {
  const state = useOnboardingState();
  return (
    <div className={styles.step}>
      <StepHero icon="sandbox" title={ONBOARDING_LABELS.titles.sandbox} description={SANDBOX_STEP_LABELS.description} />
      {state ? <SandboxForm state={state} /> : null}
    </div>
  );
}

function SandboxForm({ state }: { state: OnboardingState }) {
  const step = useSandboxStep(state);
  return (
    <>
      {step.existing?.container && !step.showBuild ? (
        <ExistingNotice existing={step.existing} busy={step.busy} onUse={step.useExisting} />
      ) : null}
      <AnimatePresence initial={false}>
        {step.showBuild ? (
          <BuildSection key="build" phase={step.phase} source={step.source} track={step.track} log={step.log} now={step.now} />
        ) : null}
      </AnimatePresence>
      <ReachabilitySection form={step.form} busy={step.busy} tailscaleIp={step.tailscaleIp} onOpenKeys={step.openTailscaleKeys} />
      <SourceSection
        source={step.source}
        available={step.available}
        existing={step.existing}
        busy={step.busy}
        now={step.now}
        onSelect={step.setSource}
      />
      <ToolsSection form={step.form} disk={step.disk} source={step.source} busy={step.busy} />
      <ResourcesSection form={step.form} limits={step.limits} busy={step.busy} />
      <AdvancedSection form={step.form} busy={step.busy} />
      <SandboxFooter
        mode={step.mode}
        source={step.source}
        canStart={step.canStart}
        pending={step.pending}
        onBack={step.back}
        onStart={step.start}
        onCancel={step.cancel}
        onContinue={step.proceed}
      />
    </>
  );
}
