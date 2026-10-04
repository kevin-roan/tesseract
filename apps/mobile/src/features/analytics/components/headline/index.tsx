import { useMemo } from "react";
import { View } from "react-native";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize, MaxFontSizeMultiplier } from "@/theme";

import type { Headline as HeadlineModel } from "../../utils/view-model";
import createStyles from "./styles";

export type HeadlineProps = {
  label: string;
  headline: HeadlineModel;
  testID?: string;
};

/** The one hero figure on the screen. Token growth is neither good nor bad, so the delta stays in neutral ink. */
const Headline = ({ label, headline, testID }: HeadlineProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const DeltaIcon =
    headline.delta?.kind === "up" ? ArrowUpRightIcon : headline.delta?.kind === "down" ? ArrowDownRightIcon : null;

  return (
    <View
      style={styles.headline}
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${headline.exact}${headline.caption ? `. ${headline.caption}` : ""}`}
    >
      <ThemedText variant="label" color="textSecondary" maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
        {label}
      </ThemedText>
      <View style={styles.figure}>
        <ThemedText variant="metric" numberOfLines={1} style={styles.value}>
          {headline.value}
        </ThemedText>
        <ThemedText variant="caption" color="textSecondary" style={styles.tabular}>
          {headline.exact}
        </ThemedText>
      </View>
      {headline.caption ? (
        <View style={styles.delta}>
          {DeltaIcon ? <DeltaIcon size={IconSize.xs} color={theme.colors.textSecondary} weight="regular" /> : null}
          <ThemedText variant="caption" color="textSecondary" style={styles.tabular}>
            {headline.caption}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
};

export default Headline;
