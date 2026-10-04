import { useMemo } from "react";
import { View } from "react-native";

import Skeleton from "@/components/skeleton";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type AnalyticsSkeletonProps = {
  tiles?: number;
};

const AnalyticsSkeleton = ({ tiles = 4 }: AnalyticsSkeletonProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.skeleton} accessibilityLabel="Loading usage" accessibilityRole="progressbar" testID="analytics-skeleton">
      <View style={styles.stack}>
        <Skeleton height={14} width="35%" />
        <Skeleton height={48} width="55%" />
      </View>
      <Skeleton height={240} radius="card" />
      <View style={styles.tiles}>
        {Array.from({ length: tiles }, (_, index) => (
          <View key={index} style={styles.tile}>
            <Skeleton height={96} radius="card" />
          </View>
        ))}
      </View>
    </View>
  );
};

export default AnalyticsSkeleton;
