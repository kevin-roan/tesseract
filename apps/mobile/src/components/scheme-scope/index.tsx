import type { ReactNode } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { useAppTheme } from "@/hooks/use-app-theme";
import { SchemeOverrideContext } from "@/hooks/use-scheme-override";
import type { ColorSchemeName } from "@/theme";

import styles from "./styles";

export type SchemeScopeProps = {
  scheme: ColorSchemeName;
  children: ReactNode;
};

const Canvas = ({ children }: { children: ReactNode }) => {
  const theme = useAppTheme();

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.mode === "light" ? "dark" : "light"} />
      {children}
    </View>
  );
};

/** Renders its subtree in a fixed color scheme, whatever the system one is. */
const SchemeScope = ({ scheme, children }: SchemeScopeProps) => (
  <SchemeOverrideContext.Provider value={scheme}>
    <Canvas>{children}</Canvas>
  </SchemeOverrideContext.Provider>
);

export default SchemeScope;
