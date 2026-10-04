import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { useLayoutMotion } from "@/hooks/use-layout-motion";

export type RevealProps = {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Fades its content in when it appears and out when it goes. Key it on a value to cross-fade changes. */
const Reveal = ({ style, children }: RevealProps) => {
  const motion = useLayoutMotion();

  return (
    <Animated.View entering={motion.fadeIn} exiting={motion.fadeOut} layout={motion.layout} style={style}>
      {children}
    </Animated.View>
  );
};

export default Reveal;
