import { useCallback } from "react";

import { BRAND_MARK, ONBOARDING_LABELS, ONBOARDING_SLIDES } from "../utils/content";
import { useOnboardingNavigation } from "./use-onboarding-navigation";
import { useOnboardingPager } from "./use-onboarding-pager";

export function useWelcomeScreen() {
  const nav = useOnboardingNavigation();
  const pager = useOnboardingPager(ONBOARDING_SLIDES.length);
  const { next } = pager;

  const advance = useCallback(() => {
    if (!next()) nav.setup();
  }, [next, nav]);

  return {
    slides: ONBOARDING_SLIDES,
    labels: ONBOARDING_LABELS,
    brandMark: BRAND_MARK,
    pager,
    advance,
    skip: nav.setup,
    ctaLabel: pager.isLast ? ONBOARDING_LABELS.start : ONBOARDING_LABELS.next,
  };
}
