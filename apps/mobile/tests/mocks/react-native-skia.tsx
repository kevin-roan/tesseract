import { View } from "react-native";

const Passthrough = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;

export const Canvas = Passthrough;
export const Fill = Passthrough;
export const Shader = () => null;
export const Skia = {
  Color: () => new Float32Array([0, 0, 0, 1]),
  RuntimeEffect: { Make: () => ({}) },
  Path: { Make: () => ({ moveTo: () => undefined, lineTo: () => undefined, close: () => undefined }) },
};
export const useClock = () => ({ value: 0 });
export const Group = Passthrough;
export const Glyphs = Passthrough;
export const Rect = Passthrough;
export const Circle = Passthrough;
export const Oval = Passthrough;
export const Path = Passthrough;
export const Line = () => null;
export const Points = () => null;
export const Blur = () => null;
export const BlurMask = () => null;
export const LinearGradient = () => null;
export const RadialGradient = () => null;
export const useFont = (_source: unknown, size = 14) => ({
  getSize: () => size,
  getGlyphIDs: (text: string) => [...text].map((_, i) => i),
  getGlyphWidths: (ids: number[]) => ids.map(() => size / 2),
});
export const FractalNoise = () => null;
export const SweepGradient = () => null;
export const vec = (x = 0, y = 0) => ({ x, y });
export const usePathValue = () => ({ value: Skia.Path.Make() });
