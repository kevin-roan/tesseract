import { useMemo } from "react";
import { View, type DimensionValue } from "react-native";
import { Shimmer } from "react-native-fast-shimmer";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useScreenActive } from "@/hooks/use-screen-active";
import type { RadiusToken } from "@/theme";

import createStyles from "./styles";

export type SkeletonProps = {
  height: number;
  width?: DimensionValue;
  radius?: RadiusToken;
};

/** Placeholder block with a light band sweeping across it while content loads; the sweep stops while the screen is hidden. */
const Skeleton = ({ height, width = "100%", radius = "md" }: SkeletonProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const gradient = useMemo(() => ["transparent", theme.colors.shimmer, "transparent"], [theme]);
  const active = useScreenActive();

  return (
    <View
      testID="skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { height, width, borderRadius: theme.radius[radius] }]}
    >
      {active ? <Shimmer style={styles.shimmer} linearGradients={gradient} /> : null}
    </View>
  );
};

export type SkeletonListProps = SkeletonProps & {
  count: number;
};

/** A stack of placeholder rows spaced like a list of cards. */
export const SkeletonList = ({ count, ...row }: SkeletonListProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} {...row} />
      ))}
    </View>
  );
};

export default Skeleton;
