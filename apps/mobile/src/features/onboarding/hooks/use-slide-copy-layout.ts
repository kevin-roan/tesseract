import { useAppTheme } from "@/hooks/use-app-theme";
import type { TextVariant } from "@/theme";

export function useSlideCopyLayout(): { title: TextVariant; message: TextVariant } {
  const theme = useAppTheme();
  return theme.isCompactHeight ? { title: "h2", message: "bodySmall" } : { title: "h1", message: "body" };
}
