import { useAppTheme } from "@/hooks/use-app-theme";

export function useSlidePanelLayout() {
  const theme = useAppTheme();
  const compact = theme.isCompactHeight;

  return {
    compact,
    cellSize: compact ? theme.spacing.sm : undefined,
    barHeight: compact ? theme.spacing["3xl"] : undefined,
  };
}
