import { useMemo, type ReactNode } from "react";
import { View } from "react-native";
import { ArrowLeftIcon } from "phosphor-react-native";

import ConnectionDot from "@/components/connection-dot";
import type { HeaderAction } from "@/components/screen-header";
import HeaderButton from "@/components/screen-header/header-button";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { Tone } from "@/lib/tone";

import createStyles from "./styles";

export type ChatHeaderProps = {
  title: string;
  /** Dim text after the title, e.g. the model. */
  detail?: string | null;
  tone?: Tone;
  onBack: () => void;
  actions?: HeaderAction[];
  /** Row under the title, e.g. tabs. */
  tabs?: ReactNode;
};

/** Compact chat header: back, a status dot, the title with a dim detail, actions; optional tabs below. */
const ChatHeader = ({ title, detail, tone = "neutral", onBack, actions, tabs }: ChatHeaderProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <HeaderButton icon={ArrowLeftIcon} label="Go back" onPress={onBack} size="md" />
        <View style={styles.titles}>
          <ConnectionDot tone={tone} />
          <ThemedText variant="bodyStrong" numberOfLines={1} accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
          {detail ? (
            <ThemedText variant="body" color="textTertiary" numberOfLines={1} style={styles.detail}>
              {detail}
            </ThemedText>
          ) : null}
        </View>
        {actions?.map(({ id, ...action }) => <HeaderButton key={id} size="md" {...action} />)}
      </View>
      {tabs}
    </View>
  );
};

export default ChatHeader;
