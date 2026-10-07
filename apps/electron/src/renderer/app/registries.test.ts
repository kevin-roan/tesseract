import { describe, expect, it } from "vitest";
import { ONBOARDING_STEP_ALIASES, ONBOARDING_STEP_IDS, PAGE_IDS, PREFERENCES_SECTION_IDS } from "../../shared/routes";
import { ONBOARDING_STEPS } from "./registry/onboarding";
import { PAGES } from "./registry/pages";
import { PREFERENCES_SECTIONS } from "./registry/preferences";

describe("registries", () => {
  it("registers every page in GTK order", () => {
    expect(PAGES.map((page) => page.id)).toEqual([...PAGE_IDS]);
  });

  it("registers every onboarding step in order", () => {
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual(ONBOARDING_STEP_IDS.filter((id) => !ONBOARDING_STEP_ALIASES[id]));
  });

  it("registers every preferences section in order", () => {
    expect(PREFERENCES_SECTIONS.map((section) => section.id)).toEqual([...PREFERENCES_SECTION_IDS]);
  });
});
