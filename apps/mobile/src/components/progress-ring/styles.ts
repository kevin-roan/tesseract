import { StyleSheet } from "react-native";

export default function createStyles(size: number, thickness: number) {
  const inner = size - thickness * 2;

  return StyleSheet.create({
    container: {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
    },
    /** The arc has to start at the top, so the whole canvas is turned a quarter. */
    svg: {
      position: "absolute",
      transform: [{ rotate: "-90deg" }],
    },
    label: {
      maxWidth: inner * 0.8,
      fontSize: Math.max(9, Math.round(inner * 0.28)),
      lineHeight: Math.max(12, Math.round(inner * 0.36)),
      fontVariant: ["tabular-nums"],
      textAlign: "center",
    },
  });
}
