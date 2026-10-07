import { ActionButton } from "../../../components/ActionButton";
import { OnboardingFooter } from "../../shared/OnboardingFooter";
import { SHELL_LABELS } from "../../shell";
import type { BuildMode } from "../../../../shared/contracts/sandbox";
import { SANDBOX_STEP_LABELS } from "../labels";
import type { FooterMode } from "../model";
import { START_LABEL_KEY } from "../options";

const L = SANDBOX_STEP_LABELS.buttons;

export interface SandboxFooterProps {
  mode: FooterMode;
  source: BuildMode;
  canStart: boolean;
  pending: boolean;
  onBack(): void;
  onStart(): void;
  onCancel(): void;
  onContinue(): void;
}

export function SandboxFooter({ mode, source, canStart, pending, onBack, onStart, onCancel, onContinue }: SandboxFooterProps) {
  const running = mode === "running";
  const end =
    mode === "running" ? (
      <ActionButton label={SHELL_LABELS.buttons.cancel} variant="secondary" size="dialog" busy={pending} onClick={onCancel} />
    ) : mode === "done" ? (
      <ActionButton label={SHELL_LABELS.buttons.continue} variant="primary" size="dialog" onClick={onContinue} />
    ) : (
      <ActionButton
        label={mode === "failed" ? L.retry : mode === "cancelled" ? L.startAgain : L[START_LABEL_KEY[source]]}
        variant="primary"
        size="dialog"
        busy={pending}
        disabled={!canStart || pending}
        onClick={onStart}
      />
    );
  return (
    <OnboardingFooter
      start={<ActionButton label={SHELL_LABELS.buttons.back} variant="flat" size="dialog" disabled={running} onClick={onBack} />}
      end={end}
    />
  );
}
