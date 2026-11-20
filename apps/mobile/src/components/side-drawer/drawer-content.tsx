import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";

type DrawerContentProps = {
  edges: Edge[];
  style: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Pads the drawer by hook insets, not SafeAreaView: the panel starts translated off-screen, so the native view measures zero. */
export const DrawerContent = ({ edges, style, children }: DrawerContentProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        style,
        {
          paddingTop: edges.includes("top") ? insets.top : 0,
          paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
          paddingLeft: edges.includes("left") ? insets.left : 0,
          paddingRight: edges.includes("right") ? insets.right : 0,
        },
      ]}
    >
      {children}
    </View>
  );
};
