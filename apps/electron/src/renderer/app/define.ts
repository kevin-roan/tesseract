import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import type { OnboardingStepId, PageId, PageSection, PreferencesSectionId } from "../../shared/routes";
import type { IconName } from "../theme/icons";

type ViewComponent = ComponentType | LazyExoticComponent<ComponentType>;

export interface PageDefinition {
  id: PageId;
  title: string;
  icon: IconName;
  section: PageSection;
  order: number;
  component: ViewComponent;
}

export interface PreferencesSectionDefinition {
  id: PreferencesSectionId;
  title: string;
  icon: IconName;
  order: number;
  component: ViewComponent;
}

export interface OnboardingStepDefinition {
  id: OnboardingStepId;
  title: string;
  railLabel: string;
  icon: IconName;
  optional: boolean;
  component: ViewComponent;
}

export interface GalleryEntry {
  id: string;
  title: string;
  group: string;
  width?: number;
  render(): ReactNode;
}

export const definePage = (definition: PageDefinition): PageDefinition => definition;
export const definePreferencesSection = (definition: PreferencesSectionDefinition): PreferencesSectionDefinition =>
  definition;
export const defineOnboardingStep = (definition: OnboardingStepDefinition): OnboardingStepDefinition => definition;
export const defineGalleryEntry = (entry: GalleryEntry): GalleryEntry => entry;
