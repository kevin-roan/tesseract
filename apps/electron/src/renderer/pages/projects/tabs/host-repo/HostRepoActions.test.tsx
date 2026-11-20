import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import type { HostShellState } from "../../../../../shared/contracts/hostShell";
import { overrideIpcFixtures } from "../../../../fixtures";
import { renderRoutes } from "../../../../test/render";
import { HostRepoActions } from "./HostRepoActions";

MotionGlobalConfig.skipAnimations = true;

const locked: HostShellState = {
  status: "running",
  pairing: { link: "tesseract://pair?fixture", url: "http://127.0.0.1:7701", name: "workstation", pinSet: true },
  error: null,
  log: [],
  autostart: true,
  sessionExpiresAt: null,
};

describe("HostRepoActions", () => {
  it("unlocks this computer's host shell (not the routed master host) before opening a shell", async () => {
    const local = { ...locked };
    const routedUnlock = vi.fn(() => locked);
    const openTerminal = vi.fn();
    const restore = overrideIpcFixtures({
      syncback: { links: () => [{ projectId: "demo", hostPath: "/home/dev/demo", pushedAt: null, gotAt: null, confidential: false, files: 1 }] },
      hostShell: {
        // The routed host (a remote master host) stays locked; only the local one matters for terminals.
        state: () => locked,
        unlock: routedUnlock,
        localState: () => local,
        localUnlock: () => Object.assign(local, { sessionExpiresAt: Date.now() + 60 * 60_000 }),
        openTerminal,
      },
    });
    const report = vi.fn();
    renderRoutes([{ path: "*", element: <HostRepoActions projectId="demo" projectName="demo" report={report} /> }], "/projects/demo");
    fireEvent.click(await screen.findByRole("button", { name: "Shell" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/PIN/i), { target: { value: "123456" } });
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(openTerminal).toHaveBeenCalledWith({ projectId: "demo", title: "demo", kind: "shell" }));
    expect(routedUnlock).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    restore();
  });

  it("opens Claude on the active sandbox's host machine when this computer has no copy", async () => {
    const remote = { ...locked, status: "external" as const, pairing: { ...locked.pairing!, name: "mac" }, sessionExpiresAt: Date.now() + 60 * 60_000 };
    const openTerminal = vi.fn();
    const restore = overrideIpcFixtures({
      syncback: { links: () => [] },
      masterHost: {
        state: () => ({ kind: "linked", sandboxUrl: "https://sandbox", host: { link: "tesseract://host?x", url: "https://mac:8443", name: "mac.local", online: true } }),
        folder: () => "/Users/me/demo",
      },
      hostShell: { refresh: () => remote, openTerminal },
    });
    const report = vi.fn();
    renderRoutes([{ path: "*", element: <HostRepoActions projectId="demo" projectName="demo" report={report} /> }], "/projects/demo");
    expect(await screen.findByRole("group", { name: "mac" })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Claude" }));
    await waitFor(() => expect(openTerminal).toHaveBeenCalledWith({ projectId: "demo", title: "demo", kind: "claude", host: "master" }));
    expect(screen.queryByRole("button", { name: "Git" })).toBeNull();
    expect(report).not.toHaveBeenCalled();
    restore();
  });

  it("asks for the project's folder on the host machine before offering terminals", async () => {
    let saved: string | null = null;
    const restore = overrideIpcFixtures({
      syncback: { links: () => [] },
      masterHost: {
        state: () => ({ kind: "linked", sandboxUrl: "https://sandbox", host: { link: "tesseract://host?x", url: "https://mac:8443", name: "mac", online: true } }),
        folder: () => saved,
        setFolder: (_projectId, path) => (saved = path),
      },
    });
    renderRoutes([{ path: "*", element: <HostRepoActions projectId="demo" projectName="demo" report={vi.fn()} /> }], "/projects/demo");
    fireEvent.click(await screen.findByRole("button", { name: "Choose folder" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Folder"), { target: { value: "/Users/me/demo" } });
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    expect(await screen.findByRole("button", { name: "Shell" })).toBeTruthy();
    restore();
  });
});
