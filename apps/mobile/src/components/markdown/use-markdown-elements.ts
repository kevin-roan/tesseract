import { useMemo } from "react";
import { useMarkdown } from "react-native-marked";

import { useAppTheme } from "@/hooks/use-app-theme";
import type { ThemeColor } from "@/theme";

import ThemedRenderer from "./renderer";
import createStyles from "./styles";

/** Parses markdown into themed elements, plus the styles for the block that holds them. */
export function useMarkdownElements(value: string, color: ThemeColor) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, color), [theme, color]);
  const options = useMemo(() => ({ styles, renderer: new ThemedRenderer(styles) }), [styles]);
  const elements = useMarkdown(value, options);

  return { elements, styles };
}
