import { useImperativeHandle, useMemo, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { WebView } from "react-native-webview";

import { useAppTheme } from "@/hooks/use-app-theme";
import { isAllowedUrl } from "@/lib/url";

import createStyles from "./styles";
import type { WebSurfaceProps } from "./types";

export type { WebSurfaceHandle, WebSurfaceProps } from "./types";

/**
 * Hosts a controller page. Navigation is pinned to the controller origin, and
 * the WebView is keyed by URL because a new ticket often only changes the
 * fragment, which WebKit would treat as an in-page jump instead of a reload.
 */
const WebSurface = ({
  uri,
  allowedOrigin,
  title,
  onMessage,
  onLoad,
  onError,
  onTerminate,
  style,
  ref,
}: WebSurfaceProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const webRef = useRef<WebView>(null);
  const originWhitelist = useMemo(() => [allowedOrigin], [allowedOrigin]);

  useImperativeHandle(
    ref,
    () => ({
      run: (script: string) => {
        if (!webRef.current) return false;
        webRef.current.injectJavaScript(script);
        return true;
      },
      post: (message: object) => {
        if (!webRef.current) return false;
        webRef.current.injectJavaScript(`window.postMessage(${JSON.stringify(message)}, "*");true;`);
        return true;
      },
      reload: () => webRef.current?.reload(),
    }),
    [],
  );

  return (
    <View style={[styles.container, style]}>
      <WebView
        key={uri}
        ref={webRef}
        source={{ uri }}
        originWhitelist={originWhitelist}
        onShouldStartLoadWithRequest={(request) => isAllowedUrl(request.url, allowedOrigin)}
        onMessage={(event) => onMessage?.(event.nativeEvent.data)}
        onLoad={() => onLoad?.()}
        onError={(event) => onError?.(event.nativeEvent.description)}
        onHttpError={(event) => onError?.(`HTTP ${event.nativeEvent.statusCode}`)}
        onContentProcessDidTerminate={() => onTerminate?.()}
        onRenderProcessGone={() => onTerminate?.()}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.textSecondary} />
          </View>
        )}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures={false}
        allowFileAccess={false}
        bounces={false}
        overScrollMode="never"
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        mixedContentMode="never"
        webviewDebuggingEnabled={__DEV__}
        accessibilityLabel={title}
        style={styles.webview}
      />
    </View>
  );
};

export default WebSurface;
