import { motion } from "motion/react";
import { ActionButton } from "../../components/ActionButton";
import { SettingsGroup, SwitchRow } from "../../components/PreferenceRows";
import { rise, stagger, STAGGER_MS } from "../../theme/motion";
import { ONBOARDING_LABELS } from "../labels";
import { OnboardingFooter } from "../shared/OnboardingFooter";
import { DoneHero } from "./DoneHero";
import { DONE_LABELS } from "./labels";
import { SummaryRow } from "./SummaryRow";
import { useDoneStep } from "./use-done-step";

export default function DoneStep() {
  const step = useDoneStep();
  return (
    <>
      <DoneHero title={ONBOARDING_LABELS.titles.finish} description={DONE_LABELS.description} />
      <SettingsGroup listLabel={DONE_LABELS.summary} listRole="list">
        {step.items.map((item, index) => (
          <motion.div
            key={item.id}
            role="listitem"
            variants={rise}
            initial="initial"
            animate="animate"
            transition={stagger(index, STAGGER_MS.checks)}
          >
            <SummaryRow item={item} />
          </motion.div>
        ))}
      </SettingsGroup>
      <SettingsGroup>
        <SwitchRow title={DONE_LABELS.autostart} checked={step.autostart} onChange={step.setAutostart} />
      </SettingsGroup>
      <OnboardingFooter
        end={
          <ActionButton
            variant="primary"
            size="dialog"
            label={ONBOARDING_LABELS.buttons.openTesseract}
            onClick={step.finish}
            busy={step.finishing}
            disabled={step.finishing}
            data-dialog-default=""
          />
        }
      />
    </>
  );
}
