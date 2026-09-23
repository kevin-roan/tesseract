import { Fragment, useMemo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import {
  ArrowLeftIcon,
  DotsThreeVerticalIcon,
  UsersThreeIcon,
} from "phosphor-react-native";

import { GlassButton, GlassPill, GlassSurface } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
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
  onPressBack?: () => void;
  onPressMenu?: () => void;
};

/** First letter of the first two words — "Ada Lovelace" becomes "AL". */
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/**
 * Identity block at the top of the profile: glass nav buttons over the screen
 * wash, then one glass card carrying the avatar, the name, the team pill and
 * the headline counts.
 */
const ProfileHero = ({
  name,
  tagline,
  team,
  photo,
  stats,
  onPressBack,
  onPressMenu,
}: ProfileHeroProps) => {
  const theme = useAppTheme();
  const size = theme.isTablet ? AvatarSize.xl : AvatarSize.lg * 1.5;
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  return (
    <View style={styles.hero}>
      <View style={styles.navRow}>
        {onPressBack ? (
          <GlassButton
            accessibilityLabel="Go back"
            onPress={onPressBack}
            style={styles.navButton}
          >
            <ArrowLeftIcon
              size={IconSize.md}
              color={theme.colors.text}
              weight="bold"
            />
          </GlassButton>
        ) : (
          <View style={styles.navSpacer} />
        )}

        {onPressMenu ? (
          <GlassButton
            accessibilityLabel="Profile options"
            onPress={onPressMenu}
            style={styles.navButton}
          >
            <DotsThreeVerticalIcon
              size={IconSize.md}
              color={theme.colors.text}
              weight="bold"
            />
          </GlassButton>
        ) : (
          <View style={styles.navSpacer} />
        )}
      </View>

      <GlassSurface style={styles.card}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            {photo ? (
              <Image
                source={{ uri: photo }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <ThemedText variant="h2" color="textSecondary">
                {initialsOf(name)}
              </ThemedText>
            )}
          </View>

          <View style={styles.names}>
            <ThemedText variant="h2" numberOfLines={2}>
              {name}
            </ThemedText>
            <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={2}>
              {tagline}
            </ThemedText>
          </View>
        </View>

        {team ? (
          <GlassPill style={styles.teamPill}>
            <UsersThreeIcon
              size={IconSize.sm}
              color={theme.colors.accentPressed}
              weight="fill"
            />
            <ThemedText variant="caption" color="textSecondary">
              {team}
            </ThemedText>
          </GlassPill>
        ) : null}

        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <Fragment key={stat.id}>
              {index > 0 ? <View style={styles.statDivider} /> : null}
              <View style={styles.stat}>
                <ThemedText variant="h3" numberOfLines={1}>
                  {stat.value}
                </ThemedText>
                <ThemedText variant="overline" color="textTertiary" numberOfLines={1}>
                  {stat.label}
                </ThemedText>
              </View>
            </Fragment>
          ))}
        </View>
      </GlassSurface>
    </View>
  );
};

export default ProfileHero;
