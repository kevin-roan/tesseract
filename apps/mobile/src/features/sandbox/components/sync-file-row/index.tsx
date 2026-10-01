import { useMemo } from "react";
import { View } from "react-native";
import type { SyncFileChange } from "@theone/protocol";

import StatusBadge from "@/components/status-badge";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { syncKindCode, syncKindTone } from "../../utils/sync";
import createStyles from "./styles";

export type SyncFileRowProps = {
  change: SyncFileChange;
};

const SyncFileRow = ({ change }: SyncFileRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} accessible accessibilityLabel={`${change.kind} ${change.path}`}>
      <StatusBadge label={syncKindCode(change.kind)} tone={syncKindTone(change.kind)} />
      <ThemedText variant="code" color="textSecondary" numberOfLines={1} ellipsizeMode="head" style={styles.path}>
        {change.path}
      </ThemedText>
    </View>
  );
};

export default SyncFileRow;
