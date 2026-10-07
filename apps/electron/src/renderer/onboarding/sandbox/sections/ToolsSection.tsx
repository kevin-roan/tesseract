import { AnimatePresence, motion } from "motion/react";
import type { BuildMode, SandboxComponent } from "../../../../shared/contracts/sandbox";
import { Notice } from "../../../components/Notice";
import { SettingsGroup } from "../../../components/PreferenceRows";
import { Reveal } from "../../../components/Reveal";
import { Text } from "../../../components/Text";
import { fade } from "../../../theme/motion";
import { COMPONENT_SIZE_GB, SANDBOX_COMPONENTS } from "../constants";
import type { SandboxForm } from "../hooks/use-sandbox-form";
import { SANDBOX_STEP_LABELS } from "../labels";
import { formatGb, imageSizeGb, toggleComponent, toggleWhisperModel, type DiskStatus } from "../model";
import { DISK_ROW, WHISPER_MODEL_CHIPS } from "../options";
import { CheckRow } from "../../shell";
import { ComponentRow } from "../parts/ComponentRow";
import { ModelChips } from "../parts/ModelChips";
import styles from "../SandboxStep.module.css";

const L = SANDBOX_STEP_LABELS.tools;

export interface ToolsSectionProps {
  form: SandboxForm;
  disk: DiskStatus | null;
  source: BuildMode;
  busy: boolean;
}

export function ToolsSection({ form, disk, source, busy }: ToolsSectionProps) {
  const { choices, replace, update } = form;
  const fixed = source !== "build";
  const components: readonly SandboxComponent[] = source === "pull" ? SANDBOX_COMPONENTS : choices.components;
  const total = formatGb(imageSizeGb(components));
  const whisperOn = components.includes("whisper");
  return (
    <SettingsGroup
      title={L.title}
      headerSuffix={
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={total} variants={fade} initial="initial" animate="animate" exit="exit">
            <Text variant="caption" color="text-secondary" tabular>
              {L.total(total)}
            </Text>
          </motion.span>
        </AnimatePresence>
      }
      actions={<Notice tone="info" message={source === "pull" ? L.prebuiltNotice : L.baseNotice} />}
    >
      <ComponentRow title={L.base.title} subtitle={L.base.subtitle} caption={L.base.caption} checked locked />
      {SANDBOX_COMPONENTS.map((component) => (
        <div key={component} className={styles.componentBlock}>
          <ComponentRow
            title={L.components[component].title}
            subtitle={L.components[component].subtitle(choices.flutterVersion)}
            caption={L.sizeCaption(formatGb(COMPONENT_SIZE_GB[component]))}
            checked={components.includes(component)}
            disabled={busy || fixed}
            onChange={(on) => replace(toggleComponent(choices, component, on))}
          />
          {component === "whisper" ? (
            <Reveal open={whisperOn}>
              <div className={styles.models}>
                <Text variant="caption" color="text-secondary">
                  {L.models}
                </Text>
                <ModelChips
                  label={L.models}
                  chips={WHISPER_MODEL_CHIPS}
                  selected={choices.whisperModels}
                  disabled={busy || fixed}
                  onToggle={(model) =>
                    update({
                      whisperModels: toggleWhisperModel(choices.whisperModels, model),
                    })
                  }
                />
              </div>
            </Reveal>
          ) : null}
        </div>
      ))}
      {disk ? (
        <CheckRow
          title={SANDBOX_STEP_LABELS.disk.title}
          subtitle={disk.message}
          status={DISK_ROW[disk.kind].status}
          badge={{ label: DISK_ROW[disk.kind].badge, tone: disk.tone }}
        />
      ) : null}
    </SettingsGroup>
  );
}
