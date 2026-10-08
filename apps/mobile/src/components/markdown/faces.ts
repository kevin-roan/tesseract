import type { TextStyle } from "react-native";

import {
  DisplayFaces,
  MonoFaces,
  SansFaces,
  SansItalicFaces,
  displayFor,
  monoFor,
  sansFor,
  sansItalicFor,
} from "@/theme";

const weightOf = (faces: Record<string, string>, face: string) =>
  Object.keys(faces).find((weight) => faces[weight] === face) as TextStyle["fontWeight"];

/**
 * Swaps a merged markdown style's weight and slant for the registered face that
 * carries them, so nested bold and italic draw in the app's own faces. Faces the
 * app does not register are left as they are.
 */
export function resolveFace(style?: TextStyle): TextStyle | undefined {
  const face = style?.fontFamily;
  if (!style || !face) return style;
  const { fontWeight, fontStyle, ...rest } = style;

  const sansWeight = weightOf(SansFaces, face) ?? weightOf(SansItalicFaces, face);
  if (sansWeight) {
    const weight = fontWeight ?? sansWeight;
    return { ...rest, fontFamily: fontStyle === "italic" ? sansItalicFor(weight) : sansFor(weight) };
  }

  const displayWeight = weightOf(DisplayFaces, face);
  if (displayWeight) return { ...rest, fontStyle, fontFamily: displayFor(fontWeight ?? displayWeight) };

  const monoWeight = weightOf(MonoFaces, face);
  if (monoWeight) return { ...rest, fontStyle, fontFamily: monoFor(fontWeight ?? monoWeight) };

  return style;
}
