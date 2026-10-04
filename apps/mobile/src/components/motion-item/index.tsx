import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { useEntrance } from "@/hooks/use-entrance";
import { useLayoutMotion } from "@/hooks/use-layout-motion";
import type { Stagger } from "@/theme";

export type MotionItemProps = {
  children: ReactNode;
  /** Position in a staggered entrance. Omit to fade in without a delay. */
  index?: number;
  stagger?: keyof typeof Stagger;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Wraps a section or row so it rises in, fades out, and glides when its neighbours change. */
const MotionItem = ({ children, index, stagger, style, testID }: MotionItemProps) => {
  const rise = useEntrance(index, stagger);
  const motion = useLayoutMotion();

  return (
    <Animated.View
      entering={index === undefined ? motion.fadeIn : rise}
      exiting={motion.fadeOut}
      layout={motion.layout}
      style={style}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
};

export default MotionItem;
