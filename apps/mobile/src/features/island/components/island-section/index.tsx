import { useMemo, type ReactNode } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type IslandSectionProps = {
  title: string;
  count?: number;
  emptyLabel?: string;
  children?: ReactNode;
  testID?: string;
};

const IslandSection = ({ title, count, emptyLabel, children, testID }: IslandSectionProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const empty = count === 0;
  if (empty && !emptyLabel) return null;

  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.header}>
        <ThemedText variant="overline" color="textSecondary">
          {title}
        </ThemedText>
        {count !== undefined && count > 0 ? (
          <ThemedText variant="caption" color="textTertiary">
            {count}
          </ThemedText>
        ) : null}
      </View>
      {empty ? (
        <ThemedText variant="bodySmall" color="textTertiary">
          {emptyLabel}
        </ThemedText>
      ) : (
        <View style={styles.rows}>{children}</View>
      )}
    </View>
  );
};

export default IslandSection;
