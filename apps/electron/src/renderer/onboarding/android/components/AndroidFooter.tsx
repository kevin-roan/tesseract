import { ActionButton } from "../../../components/ActionButton";
import { OnboardingFooter } from "../../shared/OnboardingFooter";
import { ANDROID_LABELS } from "../labels";
import type { StepMode } from "../model";

export interface AndroidFooterProps {
  mode: StepMode;
  canInstall: boolean;
  busy: boolean;
  existingAvd: string | null;
  onBack(): void;
  onSkip(): void;
  onInstall(): void;
  onUseExisting(): void;
  onCancel(): void;
  onContinue(): void;
}

const BUTTONS = ANDROID_LABELS.buttons;

export function AndroidFooter({ mode, canInstall, busy, existingAvd, onBack, onSkip, onInstall, onUseExisting, onCancel, onContinue }: AndroidFooterProps) {
  const running = mode === "running" || mode === "licenses";
  const back = <ActionButton label={BUTTONS.back} variant="flat" size="dialog" disabled={running} onClick={onBack} />;
  const skip = <ActionButton label={BUTTONS.skip} size="dialog" onClick={onSkip} />;

  if (running) {
    return <OnboardingFooter start={back} end={<ActionButton label={BUTTONS.cancel} size="dialog" disabled={busy} onClick={onCancel} />} />;
  }
  if (mode === "done" || mode === "unsupported") {
    return <OnboardingFooter start={back} end={<ActionButton label={BUTTONS.continue} variant="primary" size="dialog" onClick={mode === "done" ? onContinue : onSkip} />} />;
  }
  if (mode === "failed") {
    return (
      <OnboardingFooter
        start={back}
        end={
          <>
            {skip}
            <ActionButton label={BUTTONS.retry} variant="primary" size="dialog" busy={busy} disabled={!canInstall} onClick={onInstall} />
          </>
        }
      />
    );
  }
  return (
    <OnboardingFooter
      start={back}
      end={
        <>
          {skip}
          {existingAvd ? (
            <ActionButton label={BUTTONS.use(existingAvd)} variant="primary" size="dialog" busy={busy} disabled={busy} onClick={onUseExisting} />
          ) : (
            <ActionButton label={BUTTONS.install} variant="primary" size="dialog" busy={busy} disabled={!canInstall} onClick={onInstall} />
          )}
        </>
      }
    />
  );
}
