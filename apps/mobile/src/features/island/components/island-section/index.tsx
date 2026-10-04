import { Children, isValidElement, useMemo, type ReactNode } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier } from "@/theme";
import { useEntrance } from "@/hooks/use-entrance";

import { useIslandMotion } from "../../hooks/use-island-motion";
import createStyles from "./styles";

type SectionRowProps = {
  index: number;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
};

const SectionRow = ({ index, children, styles }: SectionRowProps) => {
  const entering = useEntrance(index, "tight");
  const motion = useIslandMotion();

  return (
    <Animated.View entering={entering} exiting={motion.fadeOut} layout={motion.layout}>
      {index > 0 ? <View style={styles.divider} /> : null}
      {children}
    </Animated.View>
  );
};

export type IslandSectionProps = {
  title: string;
  count?: number;
  emptyLabel?: string;
  children?: ReactNode;
  testID?: string;
};

const IslandSection = ({ title, count, emptyLabel, children, testID }: IslandSectionProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const motion = useIslandMotion();
  const empty = count === 0;
  if (empty && !emptyLabel) return null;

  return (
    <Animated.View layout={motion.layout} style={styles.section} testID={testID}>
      <View style={styles.header}>
        <ThemedText variant="caption" color="textTertiary" numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
          {title}
        </ThemedText>
        {count !== undefined && count > 0 ? (
          <Animated.View entering={motion.fadeIn} exiting={motion.fadeOut}>
            <TagChip label={String(count)} />
          </Animated.View>
        ) : null}
      </View>
      {empty ? (
        <Animated.View entering={motion.fadeIn}>
          <ThemedText variant="caption" color="textSecondary">
            {emptyLabel}
          </ThemedText>
        </Animated.View>
      ) : (
        <View style={styles.rows}>
          {Children.toArray(children).map((child, index) => (
            <SectionRow key={isValidElement(child) && child.key !== null ? child.key : index} index={index} styles={styles}>
              {child}
            </SectionRow>
          ))}
        </View>
      )}
    </Animated.View>
  );
};

export default IslandSection;
