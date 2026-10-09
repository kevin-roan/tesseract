import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

import Monolith from "@/components/monolith";

import { useMonolithEgg } from "../../hooks/use-monolith-egg";
import EggFace from "./face";

export type MonolithEggProps = {
  size: number;
  testID?: string;
};

/** The About screen's monolith, with a sleepy face hidden behind seven taps. */
const MonolithEgg = ({ size, testID }: MonolithEggProps) => {
  const egg = useMonolithEgg(size);

  return (
    <GestureHandlerRootView accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <GestureDetector gesture={egg.gesture}>
        <Animated.View style={egg.style}>
          <Monolith
            width={egg.box.width}
            height={egg.box.height}
            clock={egg.clock}
            overlay={(geometry) => <EggFace geometry={geometry} {...egg.face} />}
            testID={testID}
          />
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

export default MonolithEgg;
