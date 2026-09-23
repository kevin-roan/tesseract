import { StyleSheet } from "react-native";

export default function createStyles(size: number) {
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
  });
}
