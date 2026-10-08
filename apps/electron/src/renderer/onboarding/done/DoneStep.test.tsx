import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureOnboardingState } from "../../fixtures/onboarding-final/data";
import { overrideIpcFixtures } from "../../fixtures/registry";
import DoneStep from "./DoneStep";
import { DONE_LABELS } from "./labels";
import { renderStep } from "./test-harness";

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

describe("DoneStep", () => {
  it("lists what was set up and finishes with the autostart choice", async () => {
    const state = fixtureOnboardingState();
    const finish = vi.fn(() => ({
      ...state,
      completedAt: "2026-10-06T21:00:00.000Z",
    }));
    const openMain = vi.fn(() => undefined);
    restore = overrideIpcFixtures({
      onboarding: { get: () => state, finish },
      window: { openMain },
    });
    renderStep(<DoneStep />, "/onboarding/finish");
    expect(await screen.findByText("Docker Engine 29.8.1")).toBeTruthy();
    expect(screen.getByTestId("summary-android").getAttribute("data-status")).toBe("done");
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Open Tesseract" }));
    await waitFor(() => expect(finish).toHaveBeenCalledWith(false));
    await waitFor(() => expect(openMain).toHaveBeenCalled());
    expect(await screen.findByTestId("main-page")).toBeTruthy();
  });

  it("shows skipped rows", async () => {
    const state = fixtureOnboardingState({
      statuses: {
        ...fixtureOnboardingState().statuses,
        android: "skipped",
        pair: "skipped",
      },
      android: { kind: "idle" },
      pair: null,
    });
    restore = overrideIpcFixtures({ onboarding: { get: () => state } });
    renderStep(<DoneStep />, "/onboarding/finish");
    await waitFor(() => expect(screen.getByTestId("summary-pair").getAttribute("data-status")).toBe("skipped"));
    expect(screen.getAllByText(DONE_LABELS.skipped)).toHaveLength(2);
  });
});
