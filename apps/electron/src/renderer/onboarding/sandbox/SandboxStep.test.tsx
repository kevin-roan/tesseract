import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OnboardingState } from "../../../shared/contracts/onboarding";
import type { BuildMode, SetupChoices } from "../../../shared/contracts/sandbox";
import { emitFixtureEvent, overrideIpcFixtures } from "../../fixtures";
import { BUILDING_PHASE, EXISTING_RUNNING, NO_EXISTING } from "../../fixtures/onboarding-sandbox/data";
import { renderSandboxStep, sandboxState } from "./test-support";

let restore: (() => void) | null = null;

const READY_TIMEOUT_MS = 5000;

async function setup(state: OnboardingState, extra: Parameters<typeof overrideIpcFixtures>[0] = {}) {
  const calls = {
    saved: [] as SetupChoices[],
    started: [] as BuildMode[],
    cancelled: 0,
  };
  restore = overrideIpcFixtures({
    ...extra,
    onboarding: {
      get: () => state,
      sandboxSave: (choices) => {
        calls.saved.push(choices);
        return { ...state, choices };
      },
      buildStart: (mode) => {
        calls.started.push(mode);
        return { ...state, build: { kind: "preflight" } };
      },
      buildCancel: () => {
        calls.cancelled += 1;
        return { ...state, build: { kind: "cancelled" } };
      },
      ...extra.onboarding,
    },
    sandbox: {
      existing: () => NO_EXISTING,
      defaults: () => state.choices,
      validate: () => [],
      ...extra.sandbox,
    },
  });
  renderSandboxStep();
  await screen.findByText("Tools in the image", {}, { timeout: READY_TIMEOUT_MS });
  return calls;
}

function button(name: string): HTMLButtonElement {
  const footers = Array.from(document.querySelectorAll("footer"));
  const footer = footers.find((element) => within(element).queryByRole("button", { name }));
  return (footer ? within(footer) : screen).getByRole("button", { name }) as HTMLButtonElement;
}

afterEach(() => {
  restore?.();
  restore = null;
  vi.useRealTimers();
});

describe("SandboxStep", () => {
  it("lists the tools with size estimates and updates the total", async () => {
    await setup(sandboxState());
    expect(screen.getByText("Always included")).toBeTruthy();
    expect(screen.getByText("+1.4 GB")).toBeTruthy();
    expect(screen.getByText("About 7.8 GB")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Flutter" }));
    expect(await screen.findByText("About 6.4 GB")).toBeTruthy();
    expect(screen.getByText(/^Needs about 30 GB; [\d.]+ GB free$/)).toBeTruthy();
  });

  it("keeps at least one Whisper model selected", async () => {
    await setup(
      sandboxState({
        choices: { ...sandboxState().choices, whisperModels: ["base"] },
      }),
    );
    const models = await screen.findByRole("group", { name: "Models" });
    const base = within(models).getByRole("button", { name: "base" });
    fireEvent.click(base);
    expect(base.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(models).getByRole("button", { name: "medium" }));
    expect(within(models).getByRole("button", { name: "medium" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the Tailscale fields and validation messages, and blocks Build", async () => {
    await setup(sandboxState(), {
      sandbox: {
        validate: (choices) =>
          choices.mode === "tailscale"
            ? [
                {
                  field: "tailnetDomain",
                  message: "Use a tailnet domain like tail1234.ts.net",
                },
              ]
            : [],
      },
    });
    fireEvent.click(await screen.findByRole("radio", { name: /Tailscale \(sidecar\)/ }));
    expect(await screen.findByText("Use a tailnet domain like tail1234.ts.net")).toBeTruthy();
    expect(screen.getByText("Auth key")).toBeTruthy();
    await waitFor(() => expect(button("Build").disabled).toBe(true));
  });

  it("saves the choices, starts the build and cancels it", async () => {
    const state = sandboxState();
    const calls = await setup(state);
    await waitFor(() => expect(button("Build").disabled).toBe(false));
    fireEvent.click(button("Build"));
    await waitFor(() => expect(calls.started).toEqual(["build"]));
    expect(calls.saved[0]?.useExistingImage).toBe(false);
    act(() =>
      emitFixtureEvent("onboarding", "state", {
        ...state,
        build: BUILDING_PHASE,
        log: { ...state.log, build: ["#1 hello"] },
      }),
    );
    expect(await screen.findByText("Building the image…")).toBeTruthy();
    expect(screen.getByText("42%")).toBeTruthy();
    expect(screen.getByText("23 of 54 steps · 9 cached")).toBeTruthy();
    expect(button("Back").disabled).toBe(true);
    fireEvent.click(button("Cancel"));
    await waitFor(() => expect(calls.cancelled).toBe(1));
    expect(await screen.findByText("Build cancelled")).toBeTruthy();
    expect(button("Start again")).toBeTruthy();
  });

  it("opens the log and offers Retry after a failure", async () => {
    const calls = await setup(
      sandboxState({
        build: { kind: "failed", phase: "health", message: "Health timed out" },
        log: { docker: [], build: ["line one"], android: [] },
      }),
    );
    expect(await screen.findByText("Setup failed")).toBeTruthy();
    expect(screen.getByText("Health timed out")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide details" })).toBeTruthy();
    await waitFor(() => expect(button("Retry").disabled).toBe(false));
    fireEvent.click(button("Retry"));
    await waitFor(() => expect(calls.started).toEqual(["build"]));
  });

  it("adopts a running sandbox without saving choices or rebuilding", async () => {
    let adopted = 0;
    const adopt: Record<string, () => OnboardingState> = {
      sandboxAdopt: () => {
        adopted += 1;
        return sandboxState();
      },
    };
    const calls = await setup(sandboxState(), {
      sandbox: { existing: () => EXISTING_RUNNING },
      onboarding: adopt as Parameters<typeof overrideIpcFixtures>[0]["onboarding"],
    });
    expect(await screen.findByText("Found a sandbox")).toBeTruthy();
    expect(screen.getByText("Use the existing image")).toBeTruthy();
    fireEvent.click(button("Use it"));
    await waitFor(() => expect(adopted).toBe(1));
    expect(calls.started).toEqual([]);
    expect(calls.saved).toEqual([]);
  });

  it("disables the prebuilt download until an image is published", async () => {
    await setup(sandboxState());
    const pull = await screen.findByRole("radio", {
      name: /Download a prebuilt image/,
    });
    expect(pull.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("No prebuilt image is published yet.")).toBeTruthy();
  });

  it("continues past the build step when the sandbox is ready", async () => {
    const goto: string[] = [];
    await setup(
      sandboxState({
        build: {
          kind: "done",
          apiUrl: "http://127.0.0.1:7700",
          imageId: "sha256:1",
        },
      }),
      {
        onboarding: {
          goto: (step) => {
            goto.push(step);
            return sandboxState({ step });
          },
        },
      },
    );
    expect(await screen.findByText("Sandbox ready")).toBeTruthy();
    fireEvent.click(button("Continue"));
    await waitFor(() => expect(goto).toEqual(["android"]));
  });
});
