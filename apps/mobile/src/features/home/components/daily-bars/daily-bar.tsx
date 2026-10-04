import Animated from "react-native-reanimated";
import { Rect } from "react-native-svg";

import { useBarMotion, type BarMotionInput } from "./use-bar-motion";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export type DailyBarProps = BarMotionInput & {
  x: number;
  width: number;
};

/** One filled day: grows in from the baseline and lights up when focused. */
const DailyBar = ({ x, width, ...motion }: DailyBarProps) => {
  const animatedProps = useBarMotion(motion);
  return <AnimatedRect x={x} width={width} animatedProps={animatedProps} />;
};

export default DailyBar;
