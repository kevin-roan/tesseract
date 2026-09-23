import { useImperativeHandle, type Ref } from "react";
import { View, type ViewProps } from "react-native";

export const injectJavaScript = jest.fn();
export const reload = jest.fn();

type WebViewProps = ViewProps & {
  source?: { uri?: string };
  ref?: Ref<{ injectJavaScript: typeof injectJavaScript; reload: typeof reload }>;
  [key: string]: unknown;
};

export function WebView({ ref, source, ...props }: WebViewProps) {
  useImperativeHandle(ref, () => ({ injectJavaScript, reload }), []);
  return <View testID="webview" accessibilityHint={source?.uri} {...(props as ViewProps)} />;
}

export default WebView;
