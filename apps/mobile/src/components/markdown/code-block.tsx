import { memo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { CheckIcon, CopyIcon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCopyText } from "@/hooks/use-copy-text";
import { HitSlop, IconSize } from "@/theme";

import type { MarkdownStyles } from "./styles";

export type CodeBlockProps = {
  code: string;
  language?: string;
  styles: MarkdownStyles;
};

/** A fenced code block: the language and a copy button over code that scrolls sideways instead of wrapping. */
const CodeBlock = ({ code, language, styles }: CodeBlockProps) => {
  const theme = useAppTheme();
  const { copied, copy, canCopy } = useCopyText(code);
  const StateIcon = copied ? CheckIcon : CopyIcon;

  return (
    <View style={styles.code}>
      <View style={styles.codeHeader}>
        <ThemedText variant="caption" color="textTertiary" numberOfLines={1} style={styles.codeLanguage}>
          {language || "code"}
        </ThemedText>
        {canCopy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copied ? "Copied" : "Copy code"}
            hitSlop={HitSlop.md}
            onPress={copy}
          >
            <StateIcon size={IconSize.xs} color={theme.colors[copied ? "success" : "textTertiary"]} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.codeBody}>
        <Text style={styles.codeText}>{code}</Text>
      </ScrollView>
    </View>
  );
};

export default memo(CodeBlock);
