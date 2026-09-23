import { useMemo, type ReactNode } from "react";
import { View } from "react-native";
import type { Icon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import SectionHeader, { type SectionHeaderProps } from "@/components/section-header";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type SectionProps = SectionHeaderProps & {
  children?: ReactNode;
  isEmpty?: boolean;
  emptyLabel?: string;
  emptyActionLabel?: string;
  emptyActionIcon?: Icon;
  onEmptyAction?: () => void;
};

const Section = ({
  children,
  isEmpty = false,
  emptyLabel,
  emptyActionLabel,
  emptyActionIcon,
  onEmptyAction,
  ...header
}: SectionProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.section}>
      <SectionHeader {...header} />
      {isEmpty && emptyLabel ? (
        <View style={styles.empty}>
          <ThemedText variant="bodySmall" color="textTertiary">
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
        </View>
      ) : (
        children
      )}
    </View>
  );
};

export default Section;
