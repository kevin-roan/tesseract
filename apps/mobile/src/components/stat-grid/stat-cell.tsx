import type { StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import StatCard, { type StatCardProps } from "@/components/stat-card";
import { useEntrance } from "@/hooks/use-entrance";

export type StatCellProps = {
  card: StatCardProps;
  index: number;
  style: StyleProp<ViewStyle>;
};

/** One grid cell; cells rise in after each other on first mount. */
const StatCell = ({ card, index, style }: StatCellProps) => {
  const entering = useEntrance(index);

  return (
    <Animated.View entering={entering} style={style}>
      <StatCard {...card} />
    </Animated.View>
  );
};

export default StatCell;
