import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

const FILE_LIST_MAX_HEIGHT = 320;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    message: {
      paddingHorizontal: theme.spacing.xs,
    },
    files: {
      flexGrow: 0,
      maxHeight: FILE_LIST_MAX_HEIGHT,
    },
  });
}
