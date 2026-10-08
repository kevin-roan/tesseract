import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { useLocation } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { resetConnectionRuntime } from "../../app/connection";
import { SCENARIOS } from "../../fixtures/overview/http";
import { renderRoutes } from "../../test/render";
import OverviewPage from "./OverviewPage";

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderPage() {
  return renderRoutes(
    [
      {
        path: "/:pageId/*",
        element: (
          <>
            <OverviewPage />
            <LocationProbe />
          </>
        ),
      },
    ],
    "/overview",
  );
}

function setScenario(name: string | null) {
  window.history.replaceState(null, "", name ? `/?scenario=${name}` : "/");
}

describe("OverviewPage", () => {
  let skip: boolean | undefined;
  beforeAll(() => {
    skip = MotionGlobalConfig.skipAnimations;
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = skip;
  });
  afterEach(() => {
    resetConnectionRuntime();
    setScenario(null);
  });

  it("renders the sandbox status, resources and lists", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "tesseract-sandbox" })).toBeTruthy();
    expect(screen.getByText("Online")).toBeTruthy();
    expect(screen.getByText("up 7h 46m · tesseract-sandbox · v0.1.0")).toBeTruthy();
    expect(screen.getByText("11.99")).toBeTruthy();
    expect(screen.getByText("of 8 GB")).toBeTruthy();
    expect(screen.getByText("of 100 GB · /workspace")).toBeTruthy();
    expect(screen.getByText("4 cores · 5m 6.85 · 15m 4.47")).toBeTruthy();
    expect(screen.getByText("Resource history")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "15 min" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("button", { name: "5m load" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText(":1 · Available")).toBeTruthy();
    expect(screen.getByText("1600×900")).toBeTruthy();
    expect(screen.getByText("Port 5901 · Available")).toBeTruthy();
    expect(screen.getByText("24.1.0")).toBeTruthy();
    expect(screen.getByText("not installed")).toBeTruthy();
  });

  it("switches the history range and navigates from activity rows", async () => {
    renderPage();
    const fiveMinutes = await screen.findByRole("radio", { name: "5 min" });
    fireEvent.click(fiveMinutes);
    expect(fiveMinutes.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(fiveMinutes, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "15 min" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("list", { name: "Activity" })).toBeTruthy();
    fireEvent.click(screen.getByText("Running processes"));
    expect(screen.getByTestId("location").textContent).toBe("/terminals");
  });

  it("shows the empty toolchain text", async () => {
    setScenario(SCENARIOS.noTools);
    renderPage();
    expect(await screen.findByText("The controller reported no tools.")).toBeTruthy();
  });

  it("shows an empty state when the sandbox is unreachable", async () => {
    setScenario(SCENARIOS.offline);
    renderPage();
    expect(await screen.findByText("Sandbox unreachable")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preferences" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toContain("preferences="));
  });

  it("shows the attention notice and opens the inbox", async () => {
    setScenario("agents-attention");
    renderPage();
    const notice = await screen.findByText("Claude needs you");
    const container = notice.closest("[role=status]") as HTMLElement;
    fireEvent.click(within(container).getByRole("button", { name: "Open Inbox" }));
    expect(screen.getByTestId("location").textContent).toBe("/agents");
  });
});
