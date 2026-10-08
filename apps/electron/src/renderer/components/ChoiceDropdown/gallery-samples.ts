import type { ChoiceOption } from "./model";

export const PROJECT_CHOICES: readonly ChoiceOption[] = [
  { id: "all", label: "All projects" },
  { id: "streaxfit", label: "streaxfit" },
  { id: "tesseract", label: "tesseract" },
  { id: "hybrid-pos", label: "hybrid-pos" },
  { id: "sante-production", label: "sante-production" },
];

export const SOURCE_CHOICES: readonly ChoiceOption[] = [
  { id: "all", label: "All sources" },
  { id: "phone", label: "Phone" },
  { id: "desktop", label: "Desktop" },
];

export const CHOICE_GALLERY_LABELS = {
  project: "Filter by project",
  source: "Filter by source",
} as const;
