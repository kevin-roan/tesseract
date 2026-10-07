import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { skipMotionInTests } from "../../components/DialogShell/skip-motion";
import { SCENARIOS } from "../../fixtures/feedback/scenarios";
import { renderRoutes } from "../../test/render";
import { connectionController, resetConnectionRuntime } from "../connection";
import { ConnectionBanner } from "./ConnectionBanner";

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

const routes = [
  {
    path: "/:pageId/*",
    element: (
      <>
        <ConnectionBanner />
        <LocationProbe />
      </>
    ),
  },
];

function withScenario(scenario: string | null) {
  window.location.hash = scenario ? `#/overview?scenario=${scenario}` : "";
}

describe("ConnectionBanner", () => {
  beforeAll(() => {
    skipMotionInTests();
  });
  afterEach(() => {
    withScenario(null);
    resetConnectionRuntime();
  });

  it("stays hidden while the sandbox is online", async () => {
    renderRoutes(routes, "/overview");
    await waitFor(() => expect(connectionController().store.getState().status).toBe("online"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the offline banner with a Retry button", async () => {
    withScenario(SCENARIOS.offline);
    renderRoutes(routes, "/overview");
    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain("Can't reach the sandbox:");
    expect(banner.getAttribute("data-tone")).toBe("danger");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("opens the connection settings from the unauthorized banner", async () => {
    withScenario(SCENARIOS.unauthorized);
    renderRoutes(routes, "/overview");
    expect((await screen.findByRole("alert")).textContent).toContain("The sandbox rejected the saved token.");
    fireEvent.click(screen.getByRole("button", { name: "Fix Connection" }));
    expect(screen.getByTestId("location").textContent).toBe("/overview?preferences=connection");
  });

  it("explains an incompatible controller", async () => {
    withScenario(SCENARIOS.incompatible);
    renderRoutes(routes, "/overview");
    expect((await screen.findByRole("alert")).textContent).toContain("protocol v99");
    expect(screen.getByRole("button", { name: "Details" })).toBeTruthy();
  });

  it("offers Set Up when nothing is configured", async () => {
    withScenario(SCENARIOS.unconfigured);
    renderRoutes(routes, "/overview");
    expect((await screen.findByRole("status")).textContent).toContain("No sandbox is configured on this machine yet.");
    fireEvent.click(screen.getByRole("button", { name: "Set Up" }));
    expect(screen.getByTestId("location").textContent).toBe("/overview?preferences=connection");
  });

  it("shows discovery progress without a button", async () => {
    withScenario(SCENARIOS.discovering);
    renderRoutes(routes, "/overview");
    expect((await screen.findByRole("status")).textContent).toContain("Looking for the sandbox on this machine…");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
