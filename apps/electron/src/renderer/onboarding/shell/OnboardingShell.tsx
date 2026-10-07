import { AnimatePresence, motion } from "motion/react";
import { Suspense, useState } from "react";
import { Navigate, useParams } from "react-router";
import { isOnboardingStepId, ONBOARDING_STEP_ALIASES, ROUTE } from "../../../shared/routes";
import type { OnboardingStepDefinition } from "../../app/define";
import { runtime } from "../../app/runtime";
import { findOnboardingStep, ONBOARDING_STEPS } from "../../app/registry/onboarding";
import { ToastHost } from "../../components/Toast";
import { FooterTargetContext } from "../shared/footer-context";
import { ONBOARDING_TOAST_SCOPE } from "./constants";
import { railItems, stepPosition } from "./model";
import { STEP_VARIANTS } from "./motion";
import { ShellHeader } from "./ShellHeader";
import { useStatusOverrides } from "./status-store";
import { StepRail } from "./StepRail";
import { useFooterKeys } from "./use-footer-keys";
import { useOnboardingNavigation } from "./use-onboarding-navigation";
import { useOnboardingState } from "./use-onboarding-state";
import { useStepDirection } from "./use-step-direction";
import styles from "./OnboardingShell.module.css";

export function OnboardingShell() {
  const { step: stepId } = useParams();
  const alias = stepId && isOnboardingStepId(stepId) ? ONBOARDING_STEP_ALIASES[stepId] : undefined;
  if (alias) return <Navigate to={ROUTE.onboarding(alias)} replace />;
  const step = findOnboardingStep(stepId);
  const first = ONBOARDING_STEPS[0];
  if (!step) return first ? <Navigate to={ROUTE.onboarding(first.id)} replace /> : null;
  return <ShellFrame step={step} />;
}

function ShellFrame({ step }: { step: OnboardingStepDefinition }) {
  const state = useOnboardingState();
  const overrides = useStatusOverrides((store) => store.overrides);
  const navigation = useOnboardingNavigation();
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const { index, total } = stepPosition(ONBOARDING_STEPS, step.id);
  const direction = useStepDirection(index);
  const items = railItems(ONBOARDING_STEPS, step.id, state?.statuses ?? {}, overrides);
  useFooterKeys(footer);
  const Content = step.component;

  return (
    <div className={styles.window}>
      <StepRail items={items} version={runtime.version} onSelect={navigation.goTo} />
      <section className={styles.panel}>
        <ShellHeader title={step.title} index={index} total={total} showWindowControls={runtime.platform !== "darwin"} />
        <div className={styles.body}>
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step.id}
              className={styles.page}
              custom={direction}
              variants={STEP_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <FooterTargetContext.Provider value={footer}>
                <Suspense fallback={null}>
                  <Content />
                </Suspense>
              </FooterTargetContext.Provider>
            </motion.div>
          </AnimatePresence>
        </div>
        <footer ref={setFooter} className={styles.footer} />
        <ToastHost scope={ONBOARDING_TOAST_SCOPE} />
      </section>
    </div>
  );
}
