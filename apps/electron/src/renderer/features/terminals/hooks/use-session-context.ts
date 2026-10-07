import { useEffect, useRef } from "react";
import { useIsOnline } from "../../../app/connection";
import { useApiClient } from "../../../app/data";
import { useScheme } from "../../../app/scheme";
import { ipc } from "../../../lib/ipc";
import { terminalSessions } from "../sessions";

const openLink = (url: string) => void ipc.app.openExternal(url).catch(() => undefined);
const readClipboard = () => navigator.clipboard.readText();
const writeClipboard = (text: string) => navigator.clipboard.writeText(text);

export function useSessionContext(): boolean {
  const client = useApiClient();
  const scheme = useScheme();
  const online = useIsOnline();

  useEffect(() => {
    if (client) terminalSessions.configure({ client, scheme, openLink, readClipboard, writeClipboard });
  }, [client, scheme]);

  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) terminalSessions.reconnectStale();
    wasOnline.current = online;
  }, [online]);

  return client !== null;
}
