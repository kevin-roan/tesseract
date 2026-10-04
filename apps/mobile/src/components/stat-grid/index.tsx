import { useMemo } from "react";
import { View } from "react-native";

import type { StatCardProps } from "@/components/stat-card";
import { useAppTheme } from "@/hooks/use-app-theme";

import StatCell from "./stat-cell";
import createStyles from "./styles";

export type StatItem = StatCardProps & { id: string };

export type StatGridProps = {
  items: StatItem[];
};

/**
 * Wrapping grid of stat cards — two per row on a phone, more once the theme
 * says there is room. Cells grow to share the row, so a trailing odd card
 * stretches instead of leaving a hole.
 */
const StatGrid = ({ items }: StatGridProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.grid}>
      {items.map(({ id, ...card }, index) => (
        <StatCell key={id} card={card} index={index} style={styles.cell} />
      ))}
    </View>
  );
};

export default StatGrid;
