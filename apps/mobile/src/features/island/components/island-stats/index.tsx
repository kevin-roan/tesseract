import { useMemo } from "react";
import { View } from "react-native";

import GlassStat from "@/features/home/components/glass-stat";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type IslandStat = { id: string; value: string; label: string };

export type IslandStatsProps = {
  stats: IslandStat[];
};

const IslandStats = ({ stats }: IslandStatsProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <GlassStat key={stat.id} value={stat.value} label={stat.label} />
      ))}
    </View>
  );
};

export default IslandStats;
