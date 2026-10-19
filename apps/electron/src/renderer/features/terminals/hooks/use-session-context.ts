import { useEffect, useRef } from "react";
import { useScheme } from "../../../app/scheme";
import { ipc } from "../../../lib/ipc";
import { useTerminalsScope } from "../scope";

const openLink = (url: string) => void ipc.app.openExternal(url).catch(() => undefined);
const readClipboard = () => navigator.clipboard.readText();
const writeClipboard = (text: string) => navigator.clipboard.writeText(text);

export function useSessionContext(): boolean {
  const scope = useTerminalsScope();
  const { sessions } = scope;
  const client = scope.useClient();
  const scheme = useScheme();
  const online = scope.useOnline();

  useEffect(() => {
    if (client) sessions.configure({ client, scheme, openLink, readClipboard, writeClipboard });
  }, [sessions, client, scheme]);

  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) sessions.reconnectStale();
    wasOnline.current = online;
  }, [sessions, online]);

  return client !== null;
}
