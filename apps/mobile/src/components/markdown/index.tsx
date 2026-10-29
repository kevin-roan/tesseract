import { memo } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { useCopyText } from "@/hooks/use-copy-text";
import type { ThemeColor } from "@/theme";

import { useMarkdownElements } from "./use-markdown-elements";

export type MarkdownProps = {
  /** Markdown source. */
  children: string;
  /** Ink for the reading text; links and code keep their own colors. */
  color?: ThemeColor;
  /** Long-press copies the source, since the text itself is not selectable. Turn off inside another pressable. */
  copyable?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Markdown drawn in the app's type scale, faces and colors. Renders inline, so it nests inside lists and scroll views. */
const Markdown = ({ children, color = "text", copyable = true, style, testID }: MarkdownProps) => {
  const { elements, styles } = useMarkdownElements(children, color);
  const { copy, canCopy } = useCopyText(children);

  if (!copyable || !canCopy) {
    return (
      <View style={[styles.root, style]} testID={testID}>
        {elements}
      </View>
    );
  }

  return (
    <Pressable style={[styles.root, style]} onLongPress={copy} accessible={false} testID={testID}>
      {elements}
    </Pressable>
  );
};

export default memo(Markdown);
