import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderRoutes } from "../../test/render";
import { OnboardingShell } from "./OnboardingShell";
import { useStatusOverrides } from "./status-store";
import { skipMotionDuringTests } from "./test-motion";

const routes = [{ path: "/onboarding/:step?", element: <OnboardingShell /> }];

skipMotionDuringTests();

afterEach(() => {
  useStatusOverrides.getState().reset();
});

describe("OnboardingShell", () => {
  it("renders the rail, breadcrumb and step counter", async () => {
    renderRoutes(routes, "/onboarding/welcome");
    expect(await screen.findByRole("navigation", { name: "Setup steps" })).toBeTruthy();
    expect(screen.getByText("Step 1 of 7")).toBeTruthy();
    expect(screen.getAllByText("Optional")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Welcome/ }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("button", { name: /Sandbox/ }).getAttribute("aria-disabled")).toBe("true");
  });

  it("moves forward with Get started and back with Escape", async () => {
    renderRoutes(routes, "/onboarding/welcome");
    fireEvent.click(await screen.findByRole("button", { name: "Get started" }));
    expect(await screen.findByText("Step 2 of 7")).toBeTruthy();
    expect(useStatusOverrides.getState().overrides.welcome).toBe("done");
    await screen.findByRole("button", { name: "Back" });
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(await screen.findByText("Step 1 of 7")).toBeTruthy();
  });

  it("activates the footer primary with Enter", async () => {
    renderRoutes(routes, "/onboarding/welcome");
    await screen.findByRole("button", { name: "Get started" });
    act(() => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(await screen.findByText("Step 2 of 7")).toBeTruthy();
  });

  it("redirects unknown steps to the first one", async () => {
    renderRoutes(routes, "/onboarding/nope");
    expect(await screen.findByText("Step 1 of 7")).toBeTruthy();
  });
});
