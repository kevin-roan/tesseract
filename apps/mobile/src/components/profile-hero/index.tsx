import { Fragment, useMemo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeftIcon,
  DotsThreeVerticalIcon,
  UsersThreeIcon,
} from "phosphor-react-native";

import Avatar from "@/components/avatar";
import { GlassButton } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { SurfaceToneContext } from "@/hooks/use-surface-tone";
import { AvatarSize, IconSize } from "@/theme";

import createStyles from "./styles";

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
  onPressBack?: () => void;
  onPressMenu?: () => void;
};

/**
 * Full-bleed brand header at the top of the profile: one flat brand color
 * running under the status bar, glass nav buttons, the avatar and name block,
 * and a flat row of headline counts. Pair it with a `ContentSheet` to lift the
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
  onPressBack,
  onPressMenu,
}: ProfileHeroProps) => {
  const theme = useAppTheme("brand");
  const insets = useSafeAreaInsets();
  const size = AvatarSize.xl;
  const styles = useMemo(() => createStyles(theme, insets.top), [theme, insets.top]);
  const hasNav = Boolean(onPressBack || onPressMenu);

  return (
    <SurfaceToneContext.Provider value="brand">
      <View style={styles.hero}>
        <View style={styles.overscroll} />

        {hasNav ? (
          <View style={styles.navRow}>
            {onPressBack ? (
              <GlassButton accessibilityLabel="Go back" onPress={onPressBack} style={styles.navButton}>
                <ArrowLeftIcon size={IconSize.md} color={theme.colors.text} weight="bold" />
              </GlassButton>
            ) : (
              <View style={styles.navSpacer} />
            )}

            {onPressMenu ? (
              <GlassButton accessibilityLabel={menuLabel} onPress={onPressMenu} style={styles.navButton}>
                <DotsThreeVerticalIcon size={IconSize.md} color={theme.colors.text} weight="bold" />
              </GlassButton>
            ) : (
              <View style={styles.navSpacer} />
            )}
          </View>
        ) : null}

        <View style={styles.identity}>
          <Avatar name={name} photo={photo} size={size} initialsVariant="h3" style={styles.avatar} />

          <View style={styles.names}>
            <ThemedText variant="h3" numberOfLines={2} testID={nameTestID} accessibilityRole="header">
              {name}
            </ThemedText>
            <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {tagline}
            </ThemedText>
            {team ? (
              <View style={styles.teamPill}>
                <UsersThreeIcon size={IconSize.xs} color={theme.colors.highlight} weight="fill" />
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
        </View>

        {stats.length > 0 ? (
          <View style={styles.stats}>
            {stats.map((stat, index) => (
              <Fragment key={stat.id}>
                {index > 0 ? <View style={styles.statDivider} /> : null}
                <View style={styles.stat}>
                  <ThemedText variant="h4" numberOfLines={1} style={styles.statText}>
                    {stat.value}
                  </ThemedText>
                  <ThemedText variant="overline" color="textTertiary" numberOfLines={1} style={styles.statText}>
                    {stat.label}
                  </ThemedText>
                </View>
              </Fragment>
            ))}
          </View>
        ) : null}
      </View>
    </SurfaceToneContext.Provider>
  );
};

export default ProfileHero;
