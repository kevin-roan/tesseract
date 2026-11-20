import { useMemo } from "react";
import { View } from "react-native";
import { AppleAuthenticationButton } from "expo-apple-authentication";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { APPLE_BUTTON_RADIUS, APPLE_BUTTON_STYLE, APPLE_BUTTON_TYPE } from "../../utils/apple";
import type { AuthMode } from "../../utils/form";
import createStyles from "./styles";

export type AppleSignInProps = {
  mode: AuthMode;
  dividerLabel: string;
  onPress: () => void;
  testID?: string;
};

const AppleSignIn = ({ mode, dividerLabel, onPress, testID }: AppleSignInProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <AppleAuthenticationButton
        buttonType={APPLE_BUTTON_TYPE[mode]}
        buttonStyle={APPLE_BUTTON_STYLE[theme.mode]}
        cornerRadius={APPLE_BUTTON_RADIUS}
        onPress={onPress}
        style={styles.button}
        testID={testID}
      />
      <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.rule} />
        <ThemedText variant="caption" color="textTertiary">
          {dividerLabel}
        </ThemedText>
        <View style={styles.rule} />
      </View>
    </View>
  );
};

export default AppleSignIn;
