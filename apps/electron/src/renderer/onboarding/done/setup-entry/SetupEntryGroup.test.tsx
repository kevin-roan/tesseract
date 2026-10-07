import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "../../../../shared/ipc-types";
import { overrideIpcFixtures } from "../../../fixtures/registry";
import { renderRoutes } from "../../../test/render";
import { SETUP_ENTRY_LABELS } from "./labels";
import { SetupEntryGroup } from "./SetupEntryGroup";

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

const routes = [
  { path: "/overview", element: <SetupEntryGroup /> },
  { path: "/onboarding/:step", element: <div data-testid="wizard" /> },
];

describe("SetupEntryGroup", () => {
  it("opens the setup window at the Docker step", async () => {
    const openOnboarding = vi.fn(() => undefined);
    restore = overrideIpcFixtures({ window: { openOnboarding } });
    renderRoutes(routes, "/overview");
    fireEvent.click(screen.getByRole("button", { name: SETUP_ENTRY_LABELS.action }));
    await waitFor(() => expect(openOnboarding).toHaveBeenCalledWith("docker"));
  });

  it("falls back to the wizard route without a window service", async () => {
    restore = overrideIpcFixtures({
      window: {
        openOnboarding: () => {
          throw new IpcError("unavailable", "no bridge");
        },
      },
    });
    renderRoutes(routes, "/overview");
    fireEvent.click(screen.getByRole("button", { name: SETUP_ENTRY_LABELS.action }));
    expect(await screen.findByTestId("wizard")).toBeTruthy();
  });
});
