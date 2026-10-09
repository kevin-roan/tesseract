export const PAGE_IDS = ["overview", "agents", "projects", "files", "terminals", "display", "containers", "domains"] as const;
export type PageId = (typeof PAGE_IDS)[number];
export const DEFAULT_PAGE: PageId = "overview";

export const PAGE_SECTIONS = ["sandbox", "host", "app"] as const;
export type PageSection = (typeof PAGE_SECTIONS)[number];

export const PREFERENCES_SECTION_IDS = ["connection", "appearance", "claude", "host-shell", "containers", "stt", "sandbox", "android", "about"] as const;
export type PreferencesSectionId = (typeof PREFERENCES_SECTION_IDS)[number];

export const ONBOARDING_STEP_IDS = ["welcome", "docker", "claude", "sandbox", "build", "android", "pair", "finish"] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];
export const ONBOARDING_STEP_ALIASES: Partial<Record<OnboardingStepId, OnboardingStepId>> = { build: "sandbox" };
export const OPTIONAL_ONBOARDING_STEPS: readonly OnboardingStepId[] = ["android", "pair"];

export const ROUTE = {
  page: (id: PageId, sub = "") => `/${id}${sub ? `/${sub.replace(/^\/+/, "")}` : ""}`,
  onboarding: (step: OnboardingStepId) => `/onboarding/${step}`,
  gallery: (entry?: string) => (entry ? `/gallery/${entry}` : "/gallery"),
} as const;

export const SEARCH_PARAM = {
  preferences: "preferences",
  dialog: "dialog",
  fixtures: "fixtures",
  scheme: "scheme",
} as const;

export function isPageId(value: string): value is PageId {
  return (PAGE_IDS as readonly string[]).includes(value);
}

export function isOnboardingStepId(value: string): value is OnboardingStepId {
  return (ONBOARDING_STEP_IDS as readonly string[]).includes(value);
}

export function isPreferencesSectionId(value: string): value is PreferencesSectionId {
  return (PREFERENCES_SECTION_IDS as readonly string[]).includes(value);
}
