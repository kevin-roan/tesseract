import { useMemo } from "react";
import { BlurMask, Circle, Group, Oval, Path, usePathValue } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { ObeliskGeometry } from "@/components/splash-overlay/geometry";

import { MONOLITH_EGG, heartPath, heartPose, mouthPath, obeliskFace, squintPath, traceSparks } from "../../utils/egg";

export type EggFaceValues = {
  wake: SharedValue<number>;
  blink: SharedValue<number>;
  happy: SharedValue<number>;
  lookX: SharedValue<number>;
  lookY: SharedValue<number>;
  hearts: SharedValue<number>;
  spark: SharedValue<number>;
  sparkAt: SharedValue<{ x: number; y: number }>;
};

type EggFaceProps = EggFaceValues & { geometry: ObeliskGeometry };

type EyeProps = Pick<EggFaceValues, "blink" | "happy" | "lookX" | "lookY"> & {
  x: number;
  y: number;
  unit: number;
};

const { ink, cheek, heart, spark: sparkColor } = MONOLITH_EGG.colors;

const Eye = ({ x, y, unit, blink, happy, lookX, lookY }: EyeProps) => {
  const rx = unit * 0.32;
  const ry = unit * 0.42;
  const squint = useMemo(() => squintPath(rx, ry), [rx, ry]);
  const transform = useDerivedValue(() => [
    { translateX: x + lookX.value * unit * 0.22 },
    { translateY: y + lookY.value * unit * 0.16 },
  ]);
  const lid = useDerivedValue(() => [{ scaleY: Math.max(0.08, 1 - blink.value) }]);
  const open = useDerivedValue(() => 1 - happy.value);

  return (
    <Group transform={transform}>
      <Group opacity={open} transform={lid}>
        <Oval x={-rx} y={-ry} width={rx * 2} height={ry * 2} color={ink} />
        <Circle cx={-rx * 0.3} cy={-ry * 0.4} r={unit * 0.1} color="white" />
      </Group>
      <Path
        path={squint}
        style="stroke"
        strokeWidth={unit * 0.16}
        strokeCap="round"
        strokeJoin="round"
        color={ink}
        opacity={happy}
      />
    </Group>
  );
};

const Heart = ({
  index,
  hearts,
  x,
  y,
  unit,
}: {
  index: number;
  hearts: SharedValue<number>;
  x: number;
  y: number;
  unit: number;
}) => {
  const path = useMemo(() => heartPath(unit * 1.3), [unit]);
  const pose = useDerivedValue(() => heartPose(hearts.value, index, unit));
  const transform = useDerivedValue(() => [{ translateX: x + pose.value.x }, { translateY: y + pose.value.y }]);
  const opacity = useDerivedValue(() => pose.value.opacity);
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={path} color={heart}>
        <BlurMask blur={unit * 0.15} style="solid" />
      </Path>
    </Group>
  );
};

/** The face the monolith wakes up with, the hearts it sends up and the sparks a tap throws off. */
const EggFace = ({ geometry, wake, blink, happy, lookX, lookY, hearts, spark, sparkAt }: EggFaceProps) => {
  const face = useMemo(() => obeliskFace(geometry), [geometry]);
  const { x, y, unit } = face;
  const mouth = useMemo(() => mouthPath(unit * 0.7), [unit]);
  const pop = useDerivedValue(() => [{ scale: 0.8 + wake.value * 0.2 }]);
  const sparks = usePathValue((path) => {
    "worklet";
    traceSparks(path, sparkAt.value.x, sparkAt.value.y, spark.value, MONOLITH_EGG.sparks, unit * 1.6);
  });
  const eye = { blink, happy, lookX, lookY, unit, y };

  return (
    <Group>
      <Group opacity={wake} origin={{ x, y }} transform={pop}>
        {[-1, 1].map((side) => (
          <Circle key={side} cx={x + side * unit * 1.75} cy={y + unit * 0.6} r={unit * 0.4} color={cheek} opacity={0.7}>
            <BlurMask blur={unit * 0.25} style="normal" />
          </Circle>
        ))}
        <Eye x={x - unit * 1.1} {...eye} />
        <Eye x={x + unit * 1.1} {...eye} />
        <Group transform={[{ translateX: x }, { translateY: y + unit * 0.5 }]}>
          <Path path={mouth} style="stroke" strokeWidth={unit * 0.14} strokeCap="round" color={ink} />
        </Group>
      </Group>
      {Array.from({ length: MONOLITH_EGG.hearts }, (_, index) => (
        <Heart key={index} index={index} hearts={hearts} x={geometry.tip.x} y={geometry.tip.y - unit} unit={unit} />
      ))}
      <Path path={sparks} color={sparkColor}>
        <BlurMask blur={1} style="solid" />
      </Path>
    </Group>
  );
};

export default EggFace;
