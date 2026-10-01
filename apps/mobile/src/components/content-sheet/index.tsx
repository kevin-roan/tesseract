import { useMemo, type ReactNode } from "react";
import { View } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type ContentSheetProps = {
  children: ReactNode;
  testID?: string;
};

/** Rounded panel that rides up over a full-bleed hero inside `ScreenScaffold`. */
const ContentSheet = ({ children, testID }: ContentSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.sheet} testID={testID}>
      {children}
    </View>
  );
};

export default ContentSheet;
