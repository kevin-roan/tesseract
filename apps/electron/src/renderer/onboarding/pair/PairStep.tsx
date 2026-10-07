import { motion } from "motion/react";
import { ActionButton } from "../../components/ActionButton";
import { Notice } from "../../components/Notice";
import { Skeleton } from "../../components/Skeleton";
import { fade } from "../../theme/motion";
import { ONBOARDING_LABELS } from "../labels";
import { OnboardingFooter } from "../shared/OnboardingFooter";
import { StepHero } from "../shared/StepHero";
import { QR_PLACEHOLDER_SIZE } from "./constants";
import { PAIR_STEP_LABELS } from "./labels";
import { PairPanel } from "./PairPanel";
import { usePairStep } from "./use-pair-step";
import styles from "./PairStep.module.css";

export default function PairStep() {
  const step = usePairStep();
  const { view } = step;
  return (
    <>
      <StepHero icon="pair" title={ONBOARDING_LABELS.titles.pair} description={PAIR_STEP_LABELS.description} />
      <motion.div key={view.kind} className={styles.body} variants={fade} initial="initial" animate="animate">
        {view.kind === "ready" ? (
          <PairPanel
            link={view.link}
            local={view.local}
            caption={view.caption}
            onCopy={step.copy}
            onChangeReachability={step.changeReachability}
          />
        ) : view.kind === "error" ? (
          <div className={styles.panel}>
            <Notice tone="danger" message={view.message} actionLabel={PAIR_STEP_LABELS.retry} onAction={step.reload} />
          </div>
        ) : (
          <div className={styles.panel} role="status" aria-label={PAIR_STEP_LABELS.loading}>
            <Skeleton
              shape="block"
              width={QR_PLACEHOLDER_SIZE}
              height={QR_PLACEHOLDER_SIZE}
              className={styles.placeholder}
            />
          </div>
        )}
      </motion.div>
      <OnboardingFooter
        start={<ActionButton variant="flat" size="dialog" label={ONBOARDING_LABELS.buttons.back} onClick={step.back} />}
        end={
          <>
            <ActionButton
              variant="secondary"
              size="dialog"
              label={ONBOARDING_LABELS.buttons.skip}
              onClick={step.skip}
            />
            <ActionButton
              variant="primary"
              size="dialog"
              label={ONBOARDING_LABELS.buttons.continue}
              onClick={step.next}
              data-dialog-default=""
            />
          </>
        }
      />
    </>
  );
}
