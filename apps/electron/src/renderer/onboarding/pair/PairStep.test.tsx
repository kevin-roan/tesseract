import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OnboardingState } from "../../../shared/contracts/onboarding";
import { IpcError } from "../../../shared/ipc-types";
import { FIXTURE_LOCAL_PAIR, fixtureOnboardingState } from "../../fixtures/onboarding-final/data";
import { overrideIpcFixtures } from "../../fixtures/registry";
import { renderStep } from "../done/test-harness";
import { PAIR_STEP_LABELS } from "./labels";
import PairStep from "./PairStep";

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

function mock(pairLoad: () => OnboardingState) {
  const state = fixtureOnboardingState();
  const goto = vi.fn((step: OnboardingState["step"]) => ({ ...state, step }));
  const skip = vi.fn((step: OnboardingState["step"]) => ({
    ...state,
    statuses: { ...state.statuses, [step]: "skipped" },
  }));
  restore = overrideIpcFixtures({ onboarding: { pairLoad, goto, skip } });
  return { goto, skip };
}

describe("PairStep", () => {
  it("shows the QR code, link and caption", async () => {
    mock(() => fixtureOnboardingState());
    renderStep(<PairStep />, "/onboarding/pair");
    expect(await screen.findByTestId("pair-qr")).toBeTruthy();
    expect(screen.getByTestId("pair-link").textContent).toContain("tesseract://pair");
    expect(screen.getByText("Sandbox tesseract-sandbox · https://tesseract-sandbox.tail1234.ts.net")).toBeTruthy();
    expect(screen.getByText(PAIR_STEP_LABELS.secret)).toBeTruthy();
  });

  it("replaces the QR code in local mode and links back to reachability", async () => {
    const { goto } = mock(() => fixtureOnboardingState({ pair: FIXTURE_LOCAL_PAIR }));
    renderStep(<PairStep />, "/onboarding/pair");
    expect(await screen.findByText(PAIR_STEP_LABELS.localTitle)).toBeTruthy();
    expect(screen.queryByTestId("pair-qr")).toBeNull();
    expect(screen.getByTestId("pair-link")).toBeTruthy();
    fireEvent.click(screen.getByText(PAIR_STEP_LABELS.changeReachability));
    await waitFor(() => expect(goto).toHaveBeenCalledWith("sandbox"));
  });

  it("shows an error with retry", async () => {
    const pairLoad = vi.fn(() => {
      throw new IpcError("unavailable", "no link");
    });
    mock(pairLoad);
    renderStep(<PairStep />, "/onboarding/pair");
    expect(await screen.findByText("Can't build a pairing link: no link")).toBeTruthy();
    fireEvent.click(screen.getByText(PAIR_STEP_LABELS.retry));
    await waitFor(() => expect(pairLoad).toHaveBeenCalledTimes(2));
  });

  it("skips to the finish step", async () => {
    const { skip } = mock(() => fixtureOnboardingState());
    renderStep(<PairStep />, "/onboarding/pair");
    fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
    await waitFor(() => expect(skip).toHaveBeenCalledWith("pair"));
  });
});
