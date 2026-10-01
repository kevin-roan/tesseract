import { useMemo } from "react";
import { View } from "react-native";

import type { ActionCardProps } from "@/components/action-card";
import ActionTile from "@/components/action-tile";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type ActionItem = ActionCardProps & { id: string };

export type ActionRowProps = {
  items: ActionItem[];
  /** Tiles per row. Defaults to however many items there are, up to four. */
  columns?: number;
};

/**
 * Row of round quick-action tiles. Cells share the row evenly and wrap once
 * there are more tiles than columns, so a fifth action drops to a second line.
 */
const ActionRow = ({ items, columns }: ActionRowProps) => {
  const theme = useAppTheme();
  const perRow = columns ?? Math.min(4, Math.max(1, items.length));
  const styles = useMemo(() => createStyles(theme, perRow), [theme, perRow]);

  return (
    <View style={styles.row}>
      {items.map(({ id, ...card }) => (
        <View key={id} style={styles.cell}>
          <ActionTile {...card} />
        </View>
      ))}
    </View>
  );
};

export default ActionRow;
