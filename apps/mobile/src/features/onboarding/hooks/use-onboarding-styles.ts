import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { ControlHeight } from "@/theme";

export function useOnboardingStyles() {
  const theme = useAppTheme();

  return useMemo(
    () =>
      StyleSheet.create({
        fill: {
          flex: 1,
        },
        topBar: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: ControlHeight.sm,
        },
        footer: {
          gap: theme.spacing.lg,
        },
        centered: {
          textAlign: "center",
        },
      }),
    [theme],
  );
}
