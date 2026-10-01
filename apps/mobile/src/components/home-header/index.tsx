import { useMemo } from "react";
import { View } from "react-native";
import { ListIcon, TrayIcon } from "phosphor-react-native";

import { GlassButton } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";
import { inboxBadgeLabel, inboxButtonLabel } from "./utils/labels";

export type HomeHeaderProps = {
  onOpenMenu?: () => void;
  onOpenInbox?: () => void;
  inboxCount?: number;
  menuLabel?: string;
};

const HomeHeader = ({ onOpenMenu, onOpenInbox, inboxCount = 0, menuLabel = "Open menu" }: HomeHeaderProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const badge = inboxBadgeLabel(inboxCount);

  return (
    <View style={styles.container}>
      {onOpenMenu ? (
        <GlassButton accessibilityLabel={menuLabel} onPress={onOpenMenu} style={styles.action} testID="home-header-menu">
          <ListIcon size={IconSize.md} color={theme.colors.text} weight="bold" />
        </GlassButton>
      ) : (
        <View style={styles.action} />
      )}
      {onOpenInbox ? (
        <View>
          <GlassButton
            accessibilityLabel={inboxButtonLabel(inboxCount)}
            onPress={onOpenInbox}
            style={styles.action}
            testID="home-header-inbox"
          >
            <TrayIcon size={IconSize.md} color={theme.colors.text} weight="bold" />
          </GlassButton>
          {badge ? (
            <View style={styles.badge} pointerEvents="none" importantForAccessibility="no-hide-descendants">
              <ThemedText
                variant="caption"
                color="textOnNotification"
                style={styles.badgeText}
                maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
              >
                {badge}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

export default HomeHeader;
