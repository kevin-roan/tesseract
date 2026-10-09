import { useCallback, useEffect, useRef, useState } from "react";
import { useScheme } from "../../../app/scheme";
import { errorMessage } from "../../../components/FormDialog";
import { ipc } from "../../../lib/ipc";
import { terminalTheme } from "../../../theme/palettes";
import { createXtermHost, type TerminalHost } from "../../terminals/xterm-host";
import type { ContainerShellStatus } from "../types";

interface ShellSession {
  id: string;
  host: TerminalHost;
  ready: boolean;
  stop(): void;
}

const openLink = (url: string) => void ipc.app.openExternal(url).catch(() => undefined);
const readClipboard = () => navigator.clipboard.readText();
const writeClipboard = (text: string) => navigator.clipboard.writeText(text);

export function useContainerShell(name: string) {
  const scheme = useScheme();
  const schemeRef = useRef(scheme);
  const session = useRef<ShellSession | null>(null);
  const [host, setHost] = useState<TerminalHost | null>(null);
  const [status, setStatus] = useState<ContainerShellStatus>({ kind: "idle" });

  const close = useCallback(() => {
    const current = session.current;
    session.current = null;
    if (current) {
      current.stop();
      if (current.ready) void ipc.containers.closeShell(current.id).catch(() => undefined);
      current.host.dispose();
    }
    setHost(null);
    setStatus({ kind: "idle" });
  }, []);

  const open = useCallback(() => {
    close();
    const id = crypto.randomUUID();
    const isCurrent = () => session.current?.id === id;
    const terminal = createXtermHost(schemeRef.current, {
      onInput: (data) => {
        if (session.current?.ready && isCurrent()) void ipc.containers.writeShell(id, data).catch(() => undefined);
      },
      onGrid: ({ cols, rows }) => {
        if (session.current?.ready && isCurrent()) void ipc.containers.resizeShell(id, cols, rows).catch(() => undefined);
      },
      onTitle: () => undefined,
      onSelection: () => undefined,
      openLink,
      readClipboard,
      writeClipboard,
    });
    const stops = [
      ipc.containers.on("shellData", (payload) => {
        if (payload.id === id) terminal.write(payload.data);
      }),
      ipc.containers.on("shellExit", (payload) => {
        if (payload.id !== id || !isCurrent()) return;
        terminal.setInputEnabled(false);
        setStatus({ kind: "exited", code: payload.code });
      }),
    ];
    session.current = { id, host: terminal, ready: false, stop: () => stops.forEach((stop) => stop()) };
    setHost(terminal);
    setStatus({ kind: "connecting" });
    ipc.containers.openShell({ id, name, ...terminal.grid() }).then(
      () => {
        const current = session.current;
        if (current?.id !== id) {
          void ipc.containers.closeShell(id).catch(() => undefined);
          return;
        }
        current.ready = true;
        const grid = terminal.grid();
        void ipc.containers.resizeShell(id, grid.cols, grid.rows).catch(() => undefined);
        terminal.focus();
        setStatus((previous) => (previous.kind === "connecting" ? { kind: "open" } : previous));
      },
      (error: unknown) => {
        if (!isCurrent()) return;
        close();
        setStatus({ kind: "error", message: errorMessage(error) });
      },
    );
  }, [close, name]);

  useEffect(() => {
    schemeRef.current = scheme;
    session.current?.host.setScheme(scheme);
  }, [scheme]);

  useEffect(() => close, [close, name]);

  return { host, status, open, close, background: terminalTheme(scheme).background ?? "" };
}
