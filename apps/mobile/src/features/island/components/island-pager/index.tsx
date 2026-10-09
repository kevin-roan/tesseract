import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

import DotShape from "@/components/dot-shape";
import PressableScale from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { MaxFontSizeMultiplier } from "@/theme";

import { useIslandPager } from "../../hooks/use-island-pager";
import { useNow } from "../../hooks/use-now";
import { HEADLINE_MIN_FONT_SCALE, ISLAND_PANEL_GLYPH_SIZE } from "../../utils/constants";
import { itemHeadline, type IslandItem } from "../../utils/format";
import createStyles from "./styles";

export type IslandPagerProps = {
  items: IslandItem[];
  focusedId: string | null;
  /** Full width of one page; the pager bleeds to the panel edges. */
  width: number;
  onFocus: (id: string) => void;
  onOpen: () => void;
};

/** Live tasks as swipeable pages, each a live glyph, a big figure and its title, with page dots when there are several. */
const IslandPager = ({ items, focusedId, width, onFocus, onOpen }: IslandPagerProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pager = useIslandPager(items, focusedId, onFocus, width);
  const now = useNow(items.some((item) => item.startedAt !== null));
  const open = useHapticPress(onOpen);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={pager.ref}
        horizontal
        pagingEnabled
        bounces={items.length > 1}
        scrollEnabled={items.length > 1}
        showsHorizontalScrollIndicator={false}
        contentOffset={pager.offset}
        onMomentumScrollEnd={pager.settle}
        style={styles.scroller}
        testID="island-pager"
      >
        {items.map((item) => {
          const headline = itemHeadline(item, now);
          return (
            <PressableScale
              key={item.id}
              depth="card"
              accessibilityRole="button"
              accessibilityLabel={item.caption}
              accessibilityValue={{ text: headline }}
              accessibilityHint={item.kind === "run" ? "Opens the chat" : undefined}
              onPress={open}
              style={[styles.page, { width }]}
              testID={`island-page-${item.id}`}
            >
              <DotShape size={ISLAND_PANEL_GLYPH_SIZE} color={theme.colors.text} dots={24} dotSize={2.5} scatter={0.4} animate period={2000} />
              <View style={styles.stat}>
                <Text
                  style={styles.headline}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={HEADLINE_MIN_FONT_SCALE}
                  maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
                >
                  {headline}
                </Text>
                <Text style={styles.caption} numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
                  {item.caption}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
      {items.length > 1 ? (
        <View
          style={styles.dots}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Task ${pager.index + 1} of ${items.length}`}
          accessibilityHint="Swipe the task left or right to switch"
        >
          {items.map((item, position) => (
            <View key={item.id} style={[styles.dot, position === pager.index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default IslandPager;
