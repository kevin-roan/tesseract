import { ExpanderRow, SettingsGroup, SwitchRow } from "../../../components/PreferenceRows";
import type { SandboxForm } from "../hooks/use-sandbox-form";
import { SANDBOX_STEP_LABELS } from "../labels";
import { parsePort, portText } from "../model";
import { FieldRow } from "../parts/FieldRow";

const L = SANDBOX_STEP_LABELS.advanced;

export interface AdvancedSectionProps {
  form: SandboxForm;
  busy: boolean;
}

export function AdvancedSection({ form, busy }: AdvancedSectionProps) {
  const { choices, fieldIssues, update } = form;
  return (
    <SettingsGroup>
      <ExpanderRow title={L.title}>
        <FieldRow
          title={L.project}
          value={choices.project}
          error={fieldIssues.project}
          disabled={busy}
          onChange={(project) => update({ project: project.trim() })}
        />
        <FieldRow
          title={L.image}
          value={choices.image}
          error={fieldIssues.image}
          mono
          disabled={busy}
          onChange={(image) => update({ image: image.trim() })}
        />
        <FieldRow
          title={L.controllerPort}
          value={portText(choices.controllerPort)}
          error={fieldIssues.controllerPort}
          inputMode="numeric"
          disabled={busy}
          onChange={(value) => update({ controllerPort: parsePort(value) })}
        />
        <FieldRow
          title={L.vncPort}
          value={portText(choices.vncPort)}
          error={fieldIssues.vncPort}
          inputMode="numeric"
          disabled={busy}
          onChange={(value) => update({ vncPort: parsePort(value) })}
        />
        {choices.components.includes("flutter") ? (
          <FieldRow
            title={L.flutterVersion}
            value={choices.flutterVersion}
            error={fieldIssues.flutterVersion}
            disabled={busy}
            onChange={(flutterVersion) => update({ flutterVersion: flutterVersion.trim() })}
          />
        ) : null}
        <FieldRow
          title={L.claudeCodeVersion}
          value={choices.claudeCodeVersion}
          error={fieldIssues.claudeCodeVersion}
          disabled={busy}
          onChange={(claudeCodeVersion) => update({ claudeCodeVersion: claudeCodeVersion.trim() })}
        />
        <FieldRow
          title={L.hostClaudeDir}
          value={choices.hostClaudeDir}
          error={fieldIssues.hostClaudeDir}
          mono
          disabled={busy}
          onChange={(hostClaudeDir) => update({ hostClaudeDir })}
        />
        <SwitchRow
          title={L.dind}
          subtitle={L.dindSubtitle}
          checked={choices.dind}
          disabled={busy}
          onChange={(dind) => update({ dind })}
        />
      </ExpanderRow>
    </SettingsGroup>
  );
}
