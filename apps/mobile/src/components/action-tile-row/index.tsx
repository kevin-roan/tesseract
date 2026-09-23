import { useMemo } from "react";
import { View } from "react-native";

import createRowStyles from "@/components/action-row/styles";
import ActionTile, { type ActionTileProps } from "@/components/action-tile";
import { useAppTheme } from "@/hooks/use-app-theme";

export type ActionTileItem = ActionTileProps & { id: string };

export type ActionTileRowProps = {
  items: ActionTileItem[];
  /** Tiles per row. Defaults to however many items there are, up to four. */
  columns?: number;
};

/** ActionRow's layout for tiles that can be disabled or carry an accessibility hint. */
const ActionTileRow = ({ items, columns }: ActionTileRowProps) => {
  const theme = useAppTheme();
  const perRow = columns ?? Math.min(4, Math.max(1, items.length));
  const styles = useMemo(() => createRowStyles(theme, perRow), [theme, perRow]);

  return (
    <View style={styles.row}>
      {items.map(({ id, ...tile }) => (
        <View key={id} style={styles.cell}>
          <ActionTile {...tile} />
        </View>
      ))}
    </View>
  );
};

export default ActionTileRow;
