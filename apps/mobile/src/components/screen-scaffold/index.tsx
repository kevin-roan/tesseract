import { useMemo, type ReactNode } from "react";
import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { GradientName } from "@/theme";

import createStyles from "./styles";

export type ScreenScaffoldProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  gradient?: GradientName;
  avoidKeyboard?: boolean;
};

const ScreenScaffold = ({
  children,
  header,
  footer,
  scroll = true,
  refreshing = false,
  onRefresh,
  gradient = "dusk",
  avoidKeyboard = false,
}: ScreenScaffoldProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.textSecondary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );

  return (
    <ThemedView style={styles.fill}>
      <LinearGradient {...theme.gradients[gradient]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView style={styles.fill} behavior="padding" enabled={avoidKeyboard}>
          {header ? <View style={styles.header}>{header}</View> : null}
          {body}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
};

export default ScreenScaffold;
