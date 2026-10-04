import { Fragment, useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { CaretRightIcon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import { useGrowIn } from "../../hooks/use-grow-in";
import type { BarItem } from "../../types";
import { growDelay } from "../../utils/motion";
import createStyles from "./styles";

export type BarListProps = {
  items: BarItem[];
  color: string;
  testID?: string;
};

type BarRowProps = {
  item: BarItem;
  index: number;
  share: number;
  color: string;
  styles: ReturnType<typeof createStyles>;
  testID?: string;
};

const BarRow = ({ item, index, share, color, styles, testID }: BarRowProps) => {
  const theme = useAppTheme();
  const grow = useGrowIn("x", growDelay(index));
  const label = `${item.label}, ${item.valueLabel}${item.detail ? `, ${item.detail}` : ""}`;

  const content = (
    <>
      <View style={styles.top}>
        <View style={styles.titles}>
          <ThemedText variant="label" numberOfLines={1}>
            {item.label}
          </ThemedText>
          {item.detail ? (
            <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
              {item.detail}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText variant="label" style={styles.value}>
          {item.valueLabel}
        </ThemedText>
        {item.onPress ? <CaretRightIcon size={IconSize.sm} color={theme.colors.textTertiary} weight="light" /> : null}
      </View>
      <View style={styles.track}>
        {share > 0 ? (
          <Animated.View style={[styles.bar, { flex: share, backgroundColor: color }, grow]} />
        ) : null}
        <View style={{ flex: 1 - share }} />
      </View>
    </>
  );

  return item.onPress ? (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={item.onPress}
      style={styles.row}
      testID={testID}
    >
      {content}
    </PressableScale>
  ) : (
    <View style={styles.row} accessible accessibilityLabel={label}>
      {content}
    </View>
  );
};

/** Ranked horizontal bars, longest first, each scaled against the largest value in the list. */
const BarList = ({ items, color, testID }: BarListProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const max = items.reduce((best, item) => Math.max(best, item.value), 0);

  return (
    <Surface testID={testID}>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <BarRow
            item={item}
            index={index}
            share={max > 0 ? item.value / max : 0}
            color={color}
            styles={styles}
            testID={testID && item.onPress ? `${testID}-${item.id}` : undefined}
          />
        </Fragment>
      ))}
    </Surface>
  );
};

export default BarList;
