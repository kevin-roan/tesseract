import { useMemo, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import Animated from "react-native-reanimated";
import type { Icon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import SectionHeader, { type SectionHeaderProps } from "@/components/section-header";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLayoutMotion } from "@/hooks/use-layout-motion";

import createStyles from "./styles";

export type SectionProps = SectionHeaderProps & {
  children?: ReactNode;
  isEmpty?: boolean;
  /** Shows a spinner in place of the content while the first load runs. */
  loading?: boolean;
  /** Screen-reader label for the spinner. Defaults to "Loading <title>". */
  loadingLabel?: string;
  emptyLabel?: string;
  emptyActionLabel?: string;
  emptyActionIcon?: Icon;
  onEmptyAction?: () => void;
  testID?: string;
};

const Section = ({
  children,
  isEmpty = false,
  loading = false,
  loadingLabel,
  emptyLabel,
  emptyActionLabel,
  emptyActionIcon,
  onEmptyAction,
  testID,
  ...header
}: SectionProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const motion = useLayoutMotion();

  return (
    <View style={styles.section} testID={testID}>
      <SectionHeader {...header} />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            color={theme.colors.textSecondary}
            accessibilityLabel={loadingLabel ?? `Loading ${header.title}`}
          />
        </View>
      ) : isEmpty && emptyLabel ? (
        <Animated.View entering={motion.fadeIn} style={styles.empty}>
          <ThemedText variant="bodySmall" color="textSecondary">
            {emptyLabel}
          </ThemedText>
          {emptyActionLabel && onEmptyAction ? (
            <ActionButton
              label={emptyActionLabel}
              icon={emptyActionIcon}
              onPress={onEmptyAction}
              variant="secondary"
              size="sm"
            />
          ) : null}
        </Animated.View>
      ) : (
        children
      )}
    </View>
  );
};

export default Section;
