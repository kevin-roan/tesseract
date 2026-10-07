import type { BuildMode, ExistingSandbox } from "../../../../shared/contracts/sandbox";
import { SettingsGroup } from "../../../components/PreferenceRows";
import { ChoiceRow } from "../../shell";
import { SOURCE_ORDER } from "../constants";
import { SANDBOX_STEP_LABELS } from "../labels";
import { sourceSubtitle } from "../model";

const L = SANDBOX_STEP_LABELS.source;

export interface SourceSectionProps {
  source: BuildMode;
  available: Record<BuildMode, boolean>;
  existing: ExistingSandbox | null;
  busy: boolean;
  now: number;
  onSelect(source: BuildMode): void;
}

export function SourceSection({ source, available, existing, busy, now, onSelect }: SourceSectionProps) {
  const modes = SOURCE_ORDER.filter((mode) => mode !== "existing" || available.existing);
  return (
    <SettingsGroup title={L.title} listRole="radiogroup">
      {modes.map((mode) => (
        <ChoiceRow
          key={mode}
          title={L.choices[mode].title}
          subtitle={sourceSubtitle(mode, available, existing, now)}
          checked={source === mode}
          disabled={busy || !available[mode]}
          onSelect={() => onSelect(mode)}
        />
      ))}
    </SettingsGroup>
  );
}
