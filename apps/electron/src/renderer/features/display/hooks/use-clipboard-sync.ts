import { useCallback, useEffect, useRef } from "react";
import { bridge, isFixtureMode } from "../../../app/runtime";
import { ipc } from "../../../lib/ipc";
import { normalizeClipboard, shouldPushClipboard, shouldReceiveClipboard } from "../model";
import type { VncSession } from "../vnc/session";

export interface HostClipboard {
  read(): Promise<string>;
  write(text: string): Promise<void>;
}

export const browserClipboard: HostClipboard = {
  read: () => navigator.clipboard?.readText() ?? Promise.resolve(""),
  write: (text) => navigator.clipboard?.writeText(text) ?? Promise.resolve(),
};

export const mainClipboard: HostClipboard = {
  read: () => ipc.files.readClipboard(),
  write: (text) => ipc.files.writeClipboard(text),
};

function defaultClipboard(): HostClipboard {
  return bridge() && !isFixtureMode() ? mainClipboard : browserClipboard;
}

export interface ClipboardSyncOptions {
  session: VncSession;
  host: HTMLElement;
  sync: boolean;
  viewOnly: boolean;
  connected: boolean;
  clipboard?: HostClipboard;
}

export function useClipboardSync({ session, host, sync, viewOnly, connected, clipboard = defaultClipboard() }: ClipboardSyncOptions): void {
  const last = useRef<string | null>(null);
  const flags = useRef({ sync, viewOnly, connected });
  flags.current = { sync, viewOnly, connected };

  const push = useCallback(() => {
    if (!flags.current.sync || !flags.current.connected || flags.current.viewOnly) return;
    clipboard.read().then(
      (raw) => {
        const text = normalizeClipboard(raw);
        if (!shouldPushClipboard({ ...flags.current, text, last: last.current })) return;
        last.current = text;
        session.pasteClipboard(text);
      },
      () => undefined,
    );
  }, [clipboard, session]);

  useEffect(() => {
    session.callbacks.onClipboard = (text) => {
      if (!shouldReceiveClipboard({ sync: flags.current.sync, text, last: last.current })) return;
      clipboard.write(text).then(
        () => {
          last.current = text;
        },
        () => undefined,
      );
    };
    return () => {
      session.callbacks.onClipboard = undefined;
    };
  }, [clipboard, session]);

  useEffect(() => {
    host.addEventListener("focusin", push);
    window.addEventListener("focus", push);
    return () => {
      host.removeEventListener("focusin", push);
      window.removeEventListener("focus", push);
    };
  }, [host, push]);

  useEffect(() => {
    if (sync) push();
  }, [sync, push]);
}
