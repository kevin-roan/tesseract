import type { RadioChoice } from "./RadioRows";

export type ThemeChoiceId = "system" | "light" | "dark";

export const THEME_CHOICES: readonly RadioChoice<ThemeChoiceId>[] = [
  { id: "system", title: "System", subtitle: "Follow the light or dark setting of your desktop" },
  { id: "light", title: "Light", subtitle: "Light panels with dark text" },
  { id: "dark", title: "Dark", subtitle: "Dark panels with light text" },
];

export const RADIO_GALLERY_LABELS = {
  title: "Theme",
  description: "Choose how Monolith looks on this computer.",
} as const;
