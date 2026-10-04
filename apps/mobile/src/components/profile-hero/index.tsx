import { Fragment, useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeftIcon,
  DotsThreeVerticalIcon,
  UsersThreeIcon,
  type Icon,
} from "phosphor-react-native";

import Avatar from "@/components/avatar";
import { GlassButton } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { SurfaceToneContext } from "@/hooks/use-surface-tone";
import { AvatarSize, IconSize } from "@/theme";

import createStyles from "./styles";
import { STAT_MIN_FONT_SCALE } from "./utils/constants";

export type ProfileStat = {
  id: string;
  /** Pre-formatted figure — "1 420". */
  value: string;
  label: string;
};

export type ProfileHeroProps = {
  name: string;
  /** One-line description under the name. */
  tagline: string;
  /** Team or workspace shown in the pill under the name. */
  team?: string;
  photo?: string;
  stats: ProfileStat[];
  nameTestID?: string;
  teamTestID?: string;
  menuLabel?: string;
  menuIcon?: Icon;
  onPressBack?: () => void;
  onPressMenu?: () => void;
};

/**
 * Full-bleed header at the top of the profile: one flat surface fill running
 * under the status bar, nav buttons, the avatar and name block, and a hairline
 * row of headline counts. Pair it with a `ContentSheet` to lift the
 * rest of the screen over its bottom edge.
 */
const ProfileHero = ({
  name,
  tagline,
  team,
  photo,
  stats,
  nameTestID,
  teamTestID,
  menuLabel = "Profile options",
  menuIcon: MenuIcon = DotsThreeVerticalIcon,
  onPressBack,
  onPressMenu,
}: ProfileHeroProps) => {
  const theme = useAppTheme("brand");
  const insets = useSafeAreaInsets();
  const size = AvatarSize.xl;
  const styles = useMemo(() => createStyles(theme, insets.top), [theme, insets.top]);
  const hasNav = Boolean(onPressBack || onPressMenu);
  const identityEntrance = useEntrance(0);
  const statsEntrance = useEntrance(1);

  return (
    <SurfaceToneContext.Provider value="brand">
      <View style={styles.hero}>
        <View style={styles.overscroll} />

        {hasNav ? (
          <View style={styles.navRow}>
            {onPressBack ? (
              <GlassButton accessibilityLabel="Go back" onPress={onPressBack} style={styles.navButton}>
                <ArrowLeftIcon size={IconSize.md} color={theme.colors.text} weight="regular" />
              </GlassButton>
            ) : (
              <View style={styles.navSpacer} />
            )}

            {onPressMenu ? (
              <GlassButton accessibilityLabel={menuLabel} onPress={onPressMenu} style={styles.navButton}>
                <MenuIcon size={IconSize.md} color={theme.colors.text} weight="regular" />
              </GlassButton>
            ) : (
              <View style={styles.navSpacer} />
            )}
          </View>
        ) : null}

        <Animated.View entering={identityEntrance} style={styles.identity}>
          <Avatar name={name} photo={photo} size={size} initialsVariant="h3" style={styles.avatar} />

          <View style={styles.names}>
            <ThemedText
              variant="h3"
              numberOfLines={2}
              testID={nameTestID}
              accessibilityRole="header"
            >
              {name}
            </ThemedText>
            <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {tagline}
            </ThemedText>
            {team ? (
              <View style={styles.teamPill}>
                <UsersThreeIcon size={IconSize.xs} color={theme.colors.textSecondary} weight="regular" />
                <ThemedText
                  variant="caption"
                  color="textSecondary"
                  numberOfLines={1}
                  style={styles.teamLabel}
                  testID={teamTestID}
                >
                  {team}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {stats.length > 0 ? (
          <Animated.View entering={statsEntrance} style={styles.stats}>
            {stats.map((stat, index) => (
              <Fragment key={stat.id}>
                {index > 0 ? <View style={styles.statDivider} /> : null}
                <View style={styles.stat}>
                  <ThemedText
                    variant="h4"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={STAT_MIN_FONT_SCALE}
                    style={[styles.statText, styles.statValue]}
                  >
                    {stat.value}
                  </ThemedText>
                  <ThemedText variant="caption" color="textTertiary" numberOfLines={1} style={styles.statText}>
                    {stat.label}
                  </ThemedText>
                </View>
              </Fragment>
            ))}
          </Animated.View>
        ) : null}
      </View>
    </SurfaceToneContext.Provider>
  );
};

export default ProfileHero;
