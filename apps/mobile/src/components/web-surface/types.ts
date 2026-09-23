import type { Ref } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export type WebSurfaceHandle = {
  run: (script: string) => boolean;
  post: (message: object) => boolean;
  reload: () => void;
};

export type WebSurfaceProps = {
  uri: string;
  allowedOrigin: string;
  title: string;
  onMessage?: (data: string) => void;
  onLoad?: () => void;
  onError?: (message: string) => void;
  onTerminate?: () => void;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<WebSurfaceHandle>;
};
