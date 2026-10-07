import { useMemo, type ReactNode } from "react";
import { View } from "react-native";
import { ArrowLeftIcon, XIcon, type Icon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { Tone } from "@/lib/tone";

import HeaderButton from "./header-button";
import createStyles from "./styles";
import { HeaderActionSize, HeaderSubtitleVariant, HeaderTitleVariant, type HeaderSize } from "./variants";

export type HeaderAction = {
  id: string;
  icon: Icon;
  label: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: Tone;
  bare?: boolean;
};

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  dismissible?: boolean;
  actions?: HeaderAction[];
  accessory?: ReactNode;
  /** Leads the subtitle line, e.g. a connection dot. */
  status?: ReactNode;
  size?: HeaderSize;
};

const ScreenHeader = ({
  title,
  subtitle,
  onBack,
  dismissible = false,
  actions,
  accessory,
  status,
  size = "regular",
}: ScreenHeaderProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      {onBack ? (
        <HeaderButton
          icon={dismissible ? XIcon : ArrowLeftIcon}
          label={dismissible ? "Close" : "Go back"}
          onPress={onBack}
          size="md"
        />
      ) : null}
      <View style={styles.titles}>
        <View style={styles.titleRow}>
          <ThemedText variant={HeaderTitleVariant[size]} numberOfLines={1} accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
          {accessory}
        </View>
        {subtitle || status ? (
          <View style={styles.subtitleRow}>
            {status}
            {subtitle ? (
              <ThemedText variant={HeaderSubtitleVariant[size]} color="textSecondary" numberOfLines={1} style={styles.subtitle}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </View>
      {actions?.map(({ id, ...action }) => <HeaderButton key={id} size={HeaderActionSize[size]} {...action} />)}
    </View>
  );
};

export default ScreenHeader;
