import { AnimatePresence, motion } from "motion/react";
import type { SandboxComponent } from "../../../../shared/contracts/sandbox";
import { ActionButton } from "../../../components/ActionButton";
import { Notice } from "../../../components/Notice";
import { SettingsActions, SettingsGroup } from "../../../components/PreferenceRows";
import { Reveal } from "../../../components/Reveal";
import { Text } from "../../../components/Text";
import { COMPONENT_SIZE_GB, SANDBOX_COMPONENTS } from "../../../onboarding/sandbox/constants";
import { SANDBOX_STEP_LABELS } from "../../../onboarding/sandbox/labels";
import { formatGb, imageSizeGb } from "../../../onboarding/sandbox/model";
import { ComponentRow } from "../../../onboarding/sandbox/parts/ComponentRow";
import { fade } from "../../../theme/motion";
import { SANDBOX_SETTINGS_LABELS } from "./labels";
import styles from "./SandboxPreferences.module.css";

export interface ToolsGroupProps {
  components: readonly SandboxComponent[];
  flutterVersion: string;
  dirty: boolean;
  disabled: boolean;
  rebuilding: boolean;
  onToggle(component: SandboxComponent, on: boolean): void;
  onReset(): void;
  onRebuild(): void;
}

export function ToolsGroup({ components, flutterVersion, dirty, disabled, rebuilding, onToggle, onReset, onRebuild }: ToolsGroupProps) {
  const T = SANDBOX_STEP_LABELS.tools;
  const L = SANDBOX_SETTINGS_LABELS;
  const total = formatGb(imageSizeGb(components));
  return (
    <SettingsGroup
      title={T.title}
      headerSuffix={
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={total} variants={fade} initial="initial" animate="animate" exit="exit">
            <Text variant="caption" color="text-secondary" tabular>
              {T.total(total)}
            </Text>
          </motion.span>
        </AnimatePresence>
      }
      actions={
        <div className={styles.toolsActions}>
          <Reveal open={dirty}>
            <Notice tone="info" message={L.tools.pending} />
          </Reveal>
          <SettingsActions>
            {dirty ? <ActionButton size="dialog" variant="flat" label={L.tools.reset} disabled={disabled} onClick={onReset} /> : null}
            <ActionButton size="dialog" variant="primary" icon="builds" label={L.tools.rebuild} busy={rebuilding} disabled={disabled} onClick={onRebuild} />
          </SettingsActions>
        </div>
      }
    >
      <ComponentRow title={T.base.title} subtitle={T.base.subtitle} caption={T.base.caption} checked locked />
      {SANDBOX_COMPONENTS.map((component) => (
        <ComponentRow
          key={component}
          title={T.components[component].title}
          subtitle={T.components[component].subtitle(flutterVersion)}
          caption={T.sizeCaption(formatGb(COMPONENT_SIZE_GB[component]))}
          checked={components.includes(component)}
          disabled={disabled}
          onChange={(on) => onToggle(component, on)}
        />
      ))}
    </SettingsGroup>
  );
}
