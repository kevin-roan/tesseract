import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DockerPhase, DockerReport } from "../../../shared/contracts/docker";
import { overrideIpcFixtures } from "../../fixtures";
import { renderRoutes } from "../../test/render";
import { OnboardingShell } from "../shell";
import { skipMotionDuringTests } from "../shell/test-motion";

const routes = [{ path: "/onboarding/:step?", element: <OnboardingShell /> }];

const MISSING: DockerReport = {
  cli: null,
  daemon: "unknown",
  daemonError: null,
  kind: "unknown",
  context: null,
  server: null,
  compose: null,
  buildx: null,
  checks: [{ id: "cli", status: "error", title: "Docker", detail: "Docker isn't installed", action: "install" }],
};

const READY: DockerReport = {
  ...MISSING,
  cli: { path: "/usr/bin/docker", version: "29.8.1" },
  checks: [{ id: "cli", status: "ok", title: "Docker", detail: "Docker Engine 29.8.1" }],
};

let restore: (() => void) | null = null;

function useScenario(report: DockerReport, phase: DockerPhase, extra: Record<string, unknown> = {}) {
  restore = overrideIpcFixtures({
    docker: { check: () => report, phase: () => phase, log: () => [], ...extra },
  });
}

skipMotionDuringTests();

afterEach(() => {
  restore?.();
  restore = null;
});

describe("DockerStep", () => {
  it("enables Continue when Docker is ready", async () => {
    useScenario(READY, { kind: "ready" });
    renderRoutes(routes, "/onboarding/docker");
    expect(await screen.findByText("Docker Engine 29.8.1")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("opens the install panel and requires a choice before installing", async () => {
    const requests: unknown[] = [];
    useScenario(MISSING, { kind: "blocked", reason: "Docker isn't installed" }, {
      install: (request: unknown) => {
        requests.push(request);
        return { kind: "installing", stage: "downloading", received: 0, total: null };
      },
    });
    renderRoutes(routes, "/onboarding/docker");
    fireEvent.click(await screen.findByRole("button", { name: "Install…" }));
    expect(await screen.findByText("Install Docker")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Install" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await waitFor(() => expect(requests).toEqual([{ option: "engine", acceptLicense: false }]));
  });

  it("starts a stopped engine from the row action", async () => {
    let started = 0;
    const stopped: DockerReport = {
      ...READY,
      checks: [{ id: "daemon", status: "error", title: "Engine", detail: "The Docker engine isn't running", action: "start" }],
    };
    useScenario(stopped, { kind: "blocked", reason: "The Docker engine isn't running" }, {
      start: () => {
        started += 1;
        return { kind: "starting", since: Date.now() };
      },
    });
    renderRoutes(routes, "/onboarding/docker");
    fireEvent.click(await screen.findByRole("button", { name: "Start" }));
    await waitFor(() => expect(started).toBe(1));
    expect(await screen.findByText(/Starting the engine…/)).toBeTruthy();
  });

  it("asks to log out after joining the docker group", async () => {
    useScenario(MISSING, { kind: "needs-relogin" });
    renderRoutes(routes, "/onboarding/docker");
    expect(await screen.findByText("Log out to finish")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quit Monolith" })).toBeTruthy();
  });
});
