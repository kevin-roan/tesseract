import type { Appearance } from "../../../../shared/runtime";
import type { RadioChoice } from "../../../components/RadioRows";

export const SECTION_LABELS = {
  title: "Appearance",
  themeGroup: "Theme",
  themeDescription: "Choose how Tesseract looks on this computer.",
} as const;

export const APPEARANCE_CHOICES: readonly RadioChoice<Appearance>[] = [
  { id: "system", title: "System", subtitle: "Follow the light or dark setting of your desktop" },
  { id: "light", title: "Light", subtitle: "Light panels with dark text" },
  { id: "dark", title: "Dark", subtitle: "Dark panels with light text" },
];
