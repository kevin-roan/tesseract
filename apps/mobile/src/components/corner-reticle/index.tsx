import { useMemo } from "react";
import { View } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

const CornerReticle = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.frame} pointerEvents="none">
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
    </View>
  );
};

export default CornerReticle;
