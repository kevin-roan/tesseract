import { useCallback, useState } from "react";
import { useConnectionSnapshot } from "../../../app/data";
import { useHostClient } from "../../host-shell/hooks/use-host-access";
import { canStart, canStop, deviceBadge, isLinkedTo, linkBadge, pickTarget, screenBadge, screenLive, screenOverlay } from "../model";
import type { DeviceKind, SandboxLink } from "../types";
import { useScreenSession } from "./use-screen-session";

export function useDeviceView(kind: DeviceKind) {
  const controls = kind.useControls();
  const { snapshot } = controls;
  const client = useHostClient();
  const [selected, setSelected] = useState<string | null>(null);
  const target = pickTarget(snapshot, selected);
  const screen = useScreenSession(kind.screen, client, snapshot?.device ?? null, screenLive(snapshot));

  const config = useConnectionSnapshot().data?.config ?? null;
  const sandbox: SandboxLink | null = config?.apiUrl && config.token ? { url: config.apiUrl, token: config.token } : null;
  const { link } = controls;
  const linked = isLinkedTo(snapshot?.link ?? null, sandbox?.url ?? null) && snapshot?.link?.connected === true;
  const linkToSandbox = link && sandbox ? () => link(sandbox) : null;

  const { start } = controls;
  const startTarget = useCallback(() => {
    if (target) start(target);
  }, [start, target]);

  return {
    kind,
    controls,
    snapshot,
    target,
    targets: snapshot?.targets ?? [],
    select: setSelected,
    canStart: canStart(snapshot, target) && !controls.starting,
    canStop: canStop(snapshot),
    start: startTarget,
    badge: deviceBadge(snapshot),
    link: snapshot?.available && snapshot.link
      ? { badge: linkBadge(snapshot.link, sandbox?.url ?? null), url: snapshot.link.sandboxUrl, error: snapshot.link.lastError, linked, run: linkToSandbox, hasSandbox: sandbox !== null }
      : null,
    screen,
    screenBadge: screenBadge(screen.state),
    overlay: screenOverlay(snapshot, screen.state, kind.labels),
  };
}

export type DeviceView = ReturnType<typeof useDeviceView>;
