import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

export function useAuthScreenStyles() {
  const theme = useAppTheme();

  return useMemo(
    () =>
      StyleSheet.create({
        body: {
          gap: theme.spacing.lg,
        },
        switch: {
          alignSelf: "center",
        },
        footer: {
          alignItems: "flex-start",
          gap: theme.spacing.sm,
        },
      }),
    [theme],
  );
}
