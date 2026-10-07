import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OnboardingState } from "../../../shared/contracts/onboarding";
import { claudeAccount, fixtureOnboardingState } from "../../fixtures/onboarding-final/data";
import { overrideIpcFixtures } from "../../fixtures/registry";
import { renderStep } from "../done/test-harness";
import ClaudeStep from "./ClaudeStep";
import { CLAUDE_LABELS } from "./labels";

let restore: (() => void) | null = null;

function withState(state: OnboardingState, extra: Record<string, unknown> = {}) {
  const goto = vi.fn((step: OnboardingState["step"]) => ({ ...state, step }));
  const claudeCreateDir = vi.fn(() => ({
    ...state,
    claude: [claudeAccount({ login: "missing", email: null })],
  }));
  restore = overrideIpcFixtures({
    onboarding: { claudeCheck: () => state, claudeCreateDir, goto, ...extra },
  });
  return { goto, claudeCreateDir };
}

afterEach(() => {
  restore?.();
  restore = null;
});

describe("ClaudeStep", () => {
  it("shows the signed-in account", async () => {
    withState(fixtureOnboardingState());
    renderStep(<ClaudeStep />, "/onboarding/claude");
    expect(await screen.findByText("Signed in as you@example.com")).toBeTruthy();
    expect(screen.getByText("you@example.com · Example Org")).toBeTruthy();
    expect(screen.getByText("1 more account")).toBeTruthy();
  });

  it("creates ~/.claude when the folder is missing and keeps the install notice", async () => {
    const { claudeCreateDir } = withState(fixtureOnboardingState({ claude: [] }));
    renderStep(<ClaudeStep />, "/onboarding/claude");
    expect(await screen.findByText(CLAUDE_LABELS.folderMissingTitle)).toBeTruthy();
    await waitFor(() => expect(claudeCreateDir).toHaveBeenCalledTimes(1));
    expect(screen.getByText(CLAUDE_LABELS.openInstallGuide)).toBeTruthy();
  });

  it("shows the sign-in command when not signed in", async () => {
    withState(
      fixtureOnboardingState({
        claude: [claudeAccount({ login: "invalid", email: null })],
      }),
    );
    renderStep(<ClaudeStep />, "/onboarding/claude");
    expect(await screen.findByText(CLAUDE_LABELS.notSignedInTitle)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copy/ }).closest("div")?.textContent).toContain("claude");
  });

  it("continues to the sandbox step", async () => {
    const { goto } = withState(fixtureOnboardingState());
    renderStep(<ClaudeStep />, "/onboarding/claude");
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    await waitFor(() => expect(goto).toHaveBeenCalledWith("sandbox"));
  });
});
