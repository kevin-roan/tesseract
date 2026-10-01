import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";

import ActionButton from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors } from "@/lib/tone";

import type { SyncRequestView } from "../../utils/sync";
import createStyles from "./styles";

export type SyncRequestRowProps = {
  view: SyncRequestView;
  onCancel?: () => void;
  cancelling?: boolean;
  testID?: string;
};

const SyncRequestRow = ({ view, onCancel, cancelling = false, testID }: SyncRequestRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.header}>
        <View style={styles.body}>
          <ThemedText variant="body" numberOfLines={1}>
            {view.title}
          </ThemedText>
          <ThemedText variant="bodySmall" color={ToneColors[view.tone].foreground}>
            {view.status}
          </ThemedText>
        </View>
        {view.active && !view.cancellable ? <ActivityIndicator color={theme.colors.textSecondary} /> : null}
        {view.cancellable && onCancel ? (
          <ActionButton
            label="Cancel"
            variant="secondary"
            size="sm"
            loading={cancelling}
            onPress={onCancel}
            accessibilityLabel={`Cancel ${view.title}`}
          />
        ) : null}
      </View>
      {view.conflicts.length > 0 ? (
        <View style={styles.conflicts}>
          <ThemedText variant="caption" color="textSecondary">
            Changed on the host since the push:
          </ThemedText>
          {view.conflicts.map((path) => (
            <ThemedText key={path} variant="code" color="danger" numberOfLines={1} ellipsizeMode="head">
              {path}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default SyncRequestRow;
