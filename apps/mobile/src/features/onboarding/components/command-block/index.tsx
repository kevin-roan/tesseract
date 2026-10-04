import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { CheckIcon, CopyIcon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, IconSize } from "@/theme";

import { useCopyText } from "../../hooks/use-copy-text";
import createStyles from "./styles";

export type CommandBlockProps = {
  command: string;
  line: string;
  copyLabel: string;
  copiedLabel: string;
  testID?: string;
};

const CommandBlock = ({ command, line, copyLabel, copiedLabel, testID }: CommandBlockProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { copied, copy, canCopy } = useCopyText(command);
  const StateIcon = copied ? CheckIcon : CopyIcon;

  return (
    <View style={styles.block} testID={testID}>
      <ThemedText variant="code" selectable style={styles.line}>
        {line}
      </ThemedText>
      {canCopy ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? copiedLabel : copyLabel}
          hitSlop={HitSlop.md}
          onPress={copy}
          style={({ pressed }) => [styles.copy, pressed && styles.pressed]}
        >
          <StateIcon size={IconSize.sm} color={theme.colors[copied ? "success" : "textSecondary"]} weight="regular" />
        </Pressable>
      ) : null}
    </View>
  );
};

export default CommandBlock;
