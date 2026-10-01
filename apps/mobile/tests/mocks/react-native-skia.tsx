import { View } from "react-native";

const Passthrough = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;

export const Canvas = Passthrough;
export const Fill = Passthrough;
export const Shader = () => null;
export const Skia = {
  Color: () => new Float32Array([0, 0, 0, 1]),
  RuntimeEffect: { Make: () => ({}) },
};
export const useClock = () => ({ value: 0 });
