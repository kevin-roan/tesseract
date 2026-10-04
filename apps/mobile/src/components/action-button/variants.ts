import type { IconWeight } from "phosphor-react-native";

import type { ThemeColor, Look } from "@/theme";

export type ActionButtonVariant = "primary" | "secondary" | "danger";

export const ActionButtonColors: Record<ActionButtonVariant, { background: ThemeColor; foreground: ThemeColor }> = {
  primary: { background: "accent", foreground: "textOnAccent" },
  secondary: { background: "backgroundElement", foreground: "text" },
  danger: { background: "dangerMuted", foreground: "danger" },
};

export const ActionButtonIconWeight: Record<Look, IconWeight> = {
  classic: "bold",
  graphite: "light",
};
