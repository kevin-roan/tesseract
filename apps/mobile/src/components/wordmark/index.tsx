import { useMemo } from "react";
import { Pressable, Text, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier, Timings } from "@/theme";

import createStyles from "./styles";
import { useWordmarkDecode } from "./use-wordmark-decode";

export type WordmarkProps = {
  text?: string;
  /** Letter size; defaults to the splash's, a share of the window width. */
  size?: number;
  /** Long-pressing the wordmark plays a decode animation over the letters. */
  decodeOnLongPress?: boolean;
  testID?: string;
};

/** The app name set like the splash wordmark: widely tracked Saira Light capitals over a hairline rule. */
const Wordmark = ({ text = "Tesseract", size, decodeOnLongPress = false, testID }: WordmarkProps) => {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const letterSize = size ?? Math.round(width * 0.075);
  const styles = useMemo(() => createStyles(theme, letterSize), [theme, letterSize]);
  const decode = useWordmarkDecode(text);

  return (
    <Pressable
      style={styles.root}
      testID={testID}
      disabled={!decodeOnLongPress}
      onLongPress={decode.play}
      delayLongPress={Timings.longPress}
    >
      <Text
        style={styles.letters}
        numberOfLines={1}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.fixed}
        accessibilityRole="header"
        accessibilityLabel={text}
      >
        {decode.letters
          ? decode.letters.map((letter, index) => (
              <Text key={index} style={letter.settled ? null : styles.scrambled}>
                {letter.char}
              </Text>
            ))
          : text}
      </Text>
      <Animated.View style={[styles.rule, decode.ruleStyle]} />
    </Pressable>
  );
};

export default Wordmark;
