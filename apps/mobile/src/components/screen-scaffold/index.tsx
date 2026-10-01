import { useMemo, type ReactNode } from "react";
import { KeyboardAvoidingView, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type ScreenScaffoldProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  avoidKeyboard?: boolean;
  /** Safe-area edges to pad. Defaults to all four. */
  edges?: readonly Edge[];
  testID?: string;
};

const ScreenScaffold = ({
  children,
  header,
  footer,
  scroll = true,
  refreshing = false,
  onRefresh,
  avoidKeyboard = false,
  edges,
  testID,
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
    <View style={styles.root} testID={testID}>
      <SafeAreaView style={styles.fill} edges={edges}>
        <KeyboardAvoidingView style={styles.fill} behavior="padding" enabled={avoidKeyboard}>
          {header ? <View style={styles.header}>{header}</View> : null}
          {body}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default ScreenScaffold;
