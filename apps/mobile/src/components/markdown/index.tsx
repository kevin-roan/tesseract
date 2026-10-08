import { memo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import type { ThemeColor } from "@/theme";

import { useMarkdownElements } from "./use-markdown-elements";

export type MarkdownProps = {
  /** Markdown source. */
  children: string;
  /** Ink for the reading text; links and code keep their own colors. */
  color?: ThemeColor;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Markdown drawn in the app's type scale, faces and colors. Renders inline, so it nests inside lists and scroll views. */
const Markdown = ({ children, color = "text", style, testID }: MarkdownProps) => {
  const { elements, styles } = useMarkdownElements(children, color);

  return (
    <View style={[styles.root, style]} testID={testID}>
      {elements}
    </View>
  );
};

export default memo(Markdown);
