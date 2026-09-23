import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

import { messageText } from "./message";
import createStyles, { createFrameStyle } from "./styles";
import type { WebSurfaceProps } from "./types";

export type { WebSurfaceHandle, WebSurfaceProps } from "./types";

/**
 * Browser build: the controller page runs in a sandboxed iframe. Script
 * injection is impossible across origins, so `run` reports false and callers
 * talk to the page through `post` (window.postMessage) instead.
 */
const WebSurface = ({ uri, allowedOrigin, title, onMessage, onLoad, style, ref }: WebSurfaceProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const frameStyle = useMemo(() => createFrameStyle(theme), [theme]);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      run: () => false,
      post: (message: object) => {
        const target = frameRef.current?.contentWindow;
        if (!target) return false;
        target.postMessage(message, allowedOrigin);
        return true;
      },
      reload: () => {
        if (frameRef.current) frameRef.current.src = uri;
      },
    }),
    [uri, allowedOrigin],
  );

  useEffect(() => {
    if (!onMessage) return;
    const origin = allowedOrigin.toLowerCase();
    const listener = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || event.origin.toLowerCase() !== origin) return;
      const text = messageText(event.data);
      if (text !== null) onMessage(text);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [allowedOrigin, onMessage]);

  return (
    <View style={[styles.container, style]}>
      <iframe
        key={uri}
        ref={frameRef}
        src={uri}
        title={title}
        onLoad={() => onLoad?.()}
        style={frameStyle}
        allow="clipboard-read; clipboard-write; fullscreen"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
      />
    </View>
  );
};

export default WebSurface;
