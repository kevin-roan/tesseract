import { useState } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { type AnimatedProps, type AnimatedStyle } from "react-native-reanimated";

import { usePressScale } from "@/hooks/use-press-scale";
import type { PressScale } from "@/theme";

export type PressableScaleProps = Omit<PressableProps, "style"> &
  Pick<AnimatedProps<PressableProps>, "entering" | "exiting" | "layout"> & {
    style?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
    /** Extra style while the finger is down, e.g. a pressed fill. */
    pressedStyle?: StyleProp<ViewStyle>;
    depth?: keyof typeof PressScale;
  };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that sinks on press with a spring. Drop-in for card and row presses. */
const PressableScale = ({ style, pressedStyle, depth, onPressIn, onPressOut, ...rest }: PressableScaleProps) => {
  const press = usePressScale(depth);
  const [pressed, setPressed] = useState(false);

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        press.handlers.onPressIn();
        if (pressedStyle) setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.handlers.onPressOut();
        if (pressedStyle) setPressed(false);
        onPressOut?.(event);
      }}
      style={[style, pressed && pressedStyle, press.style]}
    />
  );
};

export default PressableScale;
