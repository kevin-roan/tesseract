import { Fragment, useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier } from "@/theme";

import { STAT_MIN_FONT_SCALE } from "../../utils/constants";
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
      {stats.map((stat, index) => (
        <Fragment key={stat.id}>
          {index > 0 ? <View style={styles.rule} /> : null}
          <View style={styles.stat} accessible accessibilityLabel={`${stat.value} ${stat.label}`}>
            <ThemedText
              variant="h4"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={STAT_MIN_FONT_SCALE}
              maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
              style={styles.value}
            >
              {stat.value}
            </ThemedText>
            <ThemedText
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
            >
              {stat.label}
            </ThemedText>
          </View>
        </Fragment>
      ))}
    </View>
  );
};

export default IslandStats;
