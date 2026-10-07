import { PreferenceRow, SettingsGroup } from "../../../components/PreferenceRows";
import type { SandboxForm } from "../hooks/use-sandbox-form";
import { SANDBOX_STEP_LABELS } from "../labels";
import type { ResourceLimits } from "../model";
import { MIN_MEMORY_GB } from "../constants";
import { StepperRow } from "../parts/StepperRow";

const L = SANDBOX_STEP_LABELS.resources;

export interface ResourcesSectionProps {
  form: SandboxForm;
  limits: ResourceLimits;
  busy: boolean;
}

export function ResourcesSection({ form, limits, busy }: ResourcesSectionProps) {
  const { choices, update } = form;
  return (
    <SettingsGroup title={L.title}>
      <StepperRow
        title={L.cpus}
        value={choices.cpus}
        min={1}
        max={limits.maxCpus}
        unit={L.cpuUnit}
        decreaseLabel={L.decrease}
        increaseLabel={L.increase}
        disabled={busy}
        onChange={(cpus) => update({ cpus })}
      />
      <StepperRow
        title={L.memory}
        value={choices.memoryGb}
        min={MIN_MEMORY_GB}
        max={limits.maxMemoryGb}
        unit={L.memoryUnit}
        decreaseLabel={L.decrease}
        increaseLabel={L.increase}
        disabled={busy}
        onChange={(memoryGb) => update({ memoryGb })}
      />
      <PreferenceRow title={L.timeZone} subtitle={choices.timeZone} />
    </SettingsGroup>
  );
}
