import { useMemo } from "react";
import { Text, View, useWindowDimensions } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type WordmarkProps = {
  text?: string;
  /** Letter size; defaults to the splash's, a share of the window width. */
  size?: number;
  testID?: string;
};

/** The app name set like the splash wordmark: widely tracked Saira Light capitals over a hairline rule. */
const Wordmark = ({ text = "Tesseract", size, testID }: WordmarkProps) => {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const letterSize = size ?? Math.round(width * 0.075);
  const styles = useMemo(() => createStyles(theme, letterSize), [theme, letterSize]);

  return (
    <View style={styles.root} testID={testID}>
      <Text
        style={styles.letters}
        numberOfLines={1}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.fixed}
        accessibilityRole="header"
      >
        {text}
      </Text>
      <View style={styles.rule} />
    </View>
  );
};

export default Wordmark;
