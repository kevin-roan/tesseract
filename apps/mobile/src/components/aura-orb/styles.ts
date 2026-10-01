import { StyleSheet } from "react-native";

export default function createStyles(size: number) {
  return StyleSheet.create({
    canvas: {
      width: size,
      height: size,
    },
  });
}
