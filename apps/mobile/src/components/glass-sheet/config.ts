import type { ModalProps } from "react-native";

/** iOS rotates the whole app to fit a modal's orientations, so the sheet accepts every one. */
export const SHEET_ORIENTATIONS: ModalProps["supportedOrientations"] = [
  "portrait",
  "portrait-upside-down",
  "landscape",
  "landscape-left",
  "landscape-right",
];
