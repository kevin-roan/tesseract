import { StyleSheet, type TextStyle } from "react-native";

import { BorderWidth, FontWeights, type TextVariant, type Theme, type ThemeColor } from "@/theme";

export default function createStyles(theme: Theme, color: ThemeColor) {
  const ink = theme.colors[color];
  const variant = (name: TextVariant): TextStyle => ({ ...theme.text[name], color: ink });
  const heading = (name: TextVariant): TextStyle => ({
    ...variant(name),
    fontWeight: undefined,
    marginVertical: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  });

  return StyleSheet.create({
    root: {
      gap: theme.spacing.md,
    },
    paragraph: {},
    text: variant("body"),
    strong: { ...variant("body"), fontWeight: FontWeights.semibold },
    em: { ...variant("body"), fontStyle: "italic" },
    strikethrough: { ...variant("body"), textDecorationLine: "line-through" },
    link: {
      ...variant("body"),
      color: theme.colors.accentStrong,
      fontStyle: "normal",
      textDecorationLine: "underline",
    },
    h1: heading("h3"),
    h2: heading("h4"),
    h3: heading("bodyStrong"),
    h4: heading("bodyStrong"),
    h5: heading("bodyStrong"),
    h6: heading("bodyStrong"),
    codespan: {
      ...theme.text.code,
      color: ink,
      fontStyle: "normal",
      backgroundColor: theme.colors.codeBackground,
    },
    code: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.codeBackground,
    },
    codeText: { ...theme.text.code, color: ink },
    blockquote: {
      gap: theme.spacing.md,
      paddingLeft: theme.spacing.md,
      borderLeftWidth: BorderWidth.thick,
      borderLeftColor: theme.colors.borderStrong,
    },
    hr: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.divider,
    },
    list: {
      gap: theme.spacing.xs,
    },
    listMarker: {
      paddingRight: theme.spacing.sm,
    },
    listItem: {
      flexShrink: 1,
      gap: theme.spacing.xs,
    },
    li: variant("body"),
    table: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    tableRow: {
      flexDirection: "row",
    },
    tableCell: {
      padding: theme.spacing.sm,
    },
  });
}

export type MarkdownStyles = ReturnType<typeof createStyles>;
