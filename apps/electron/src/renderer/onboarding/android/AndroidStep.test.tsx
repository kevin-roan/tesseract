import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { InstallPlan } from "../../../shared/contracts/android";
import type { AndroidPhase, OnboardingState } from "../../../shared/contracts/onboarding";
import { IpcError } from "../../../shared/ipc-types";
import { emitFixtureEvent, overrideIpcFixtures } from "../../fixtures";
import { resetAndroidFixture } from "../../fixtures/onboarding-android/ipc";
import { UNSUPPORTED } from "../../fixtures/onboarding-android/data";
import { useStatusOverrides } from "../shell";
import { androidState, renderAndroidStep } from "./test-support";

const READY_TIMEOUT_MS = 5000;
const API_35 = "system-images;android-35;google_apis;x86_64";
const API_36 = "system-images;android-36;google_apis;x86_64";

let restore: (() => void) | null = null;

interface Calls {
  installs: InstallPlan[];
  accepted: string[];
  cancelled: number;
}

async function setup(state: OnboardingState, extra: Parameters<typeof overrideIpcFixtures>[0] = {}): Promise<Calls> {
  const calls: Calls = { installs: [], accepted: [], cancelled: 0 };
  restore = overrideIpcFixtures({
    ...extra,
    onboarding: {
      get: () => state,
      androidInstall: (plan) => {
        calls.installs.push(plan);
        return state;
      },
      androidAcceptLicense: (id) => {
        calls.accepted.push(id);
        return state;
      },
      androidCancel: () => {
        calls.cancelled += 1;
        return state;
      },
      ...extra.onboarding,
    },
  });
  renderAndroidStep();
  return calls;
}

function footerButton(name: string): HTMLButtonElement {
  const footer = document.querySelector("footer");
  if (!footer) throw new Error("footer missing");
  return within(footer as HTMLElement).getByRole("button", { name }) as HTMLButtonElement;
}

async function ready() {
  await screen.findByRole("checkbox", { name: "Install Android 16" }, { timeout: READY_TIMEOUT_MS });
}

function withPhase(android: AndroidPhase, patch: Partial<OnboardingState> = {}): OnboardingState {
  return androidState({ android, ...patch });
}

afterEach(() => {
  restore?.();
  restore = null;
  resetAndroidFixture();
  useStatusOverrides.getState().reset();
});

describe("AndroidStep", () => {
  it("lists the SDK packages with API 36 selected and sums the download", async () => {
    await setup(androidState());
    await ready();
    const table = screen.getByRole("table", { name: "SDK packages" });
    expect(within(table).getByText("Android Emulator")).toBeTruthy();
    expect(within(table).getByRole("checkbox", { name: "Install Android 16" }).getAttribute("aria-checked")).toBe("true");
    expect(within(table).getByRole("checkbox", { name: "Install Android 15" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("2.3 GB download · about 5.4 GB on disk")).toBeTruthy();

    fireEvent.click(within(table).getByRole("checkbox", { name: "Install Android 15" }));
    expect(await screen.findByText("4.0 GB download · about 9.6 GB on disk")).toBeTruthy();
  });

  it("reveals every system image on Show all", async () => {
    await setup(androidState());
    await ready();
    const table = screen.getByRole("table", { name: "SDK packages" });
    expect(within(table).queryByText("API 28")).toBeNull();
    fireEvent.click(within(table).getByRole("button", { name: "Show all 9" }));
    expect(await within(table).findByText("API 28")).toBeTruthy();
  });

  it("sends the install plan with the virtual device", async () => {
    const calls = await setup(androidState());
    await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: "Install Android 15" }));
    fireEvent.click(footerButton("Install"));
    await waitFor(() => expect(calls.installs).toHaveLength(1));
    expect(calls.installs[0]).toMatchObject({
      sdkRoot: "/home/dev/.local/share/tesseract/android-sdk",
      packages: ["platform-tools", "emulator", API_36, API_35],
      avd: { name: "Tesseract_API_36", systemImage: API_36, api: 36, abi: "x86_64", ramMb: 4096, cores: 4, deviceProfile: "pixel_5", storageMb: 6144 },
    });
  });

  it("blocks Install on an invalid device name", async () => {
    await setup(androidState());
    await ready();
    const name = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "my device" } });
    expect(await screen.findByText("Use only letters, digits, dots, dashes and underscores")).toBeTruthy();
    expect(footerButton("Install").disabled).toBe(true);
  });

  it("asks for every pending license before installing", async () => {
    const calls = await setup(withPhase({ kind: "licenses", pending: ["android-sdk-license", "android-sdk-preview-license"] }));
    const dialog = await screen.findByRole("dialog", {}, { timeout: READY_TIMEOUT_MS });
    const accept = within(dialog).getByRole("button", { name: "Accept and install" }) as HTMLButtonElement;
    expect(accept.disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "I accept the terms of this license" }));
    expect(await within(dialog).findByText("Android SDK Preview License", { selector: "span[class*='text']" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "I accept the terms of this license" }));
    await waitFor(() => expect(accept.disabled).toBe(false));
    fireEvent.click(accept);
    await waitFor(() => expect(calls.accepted).toEqual(["android-sdk-license", "android-sdk-preview-license"]));
    expect(useStatusOverrides.getState().overrides.android).toBe("running");
  });

  it("shows the download queue and cancels", async () => {
    const calls = await setup(
      withPhase(
        { kind: "installing", pkg: "emulator", index: 1, count: 3, stage: "downloading", received: 174_827_086, total: 349_654_172, bytesPerSecond: 18_200_000 },
        { log: { docker: [], build: [], android: ["platform-tools: sha1 ok"] } },
      ),
    );
    expect(await screen.findByText("175 MB of 350 MB · 18.2 MB/s", {}, { timeout: READY_TIMEOUT_MS })).toBeTruthy();
    expect(screen.getByText("Android Emulator 37.2.12")).toBeTruthy();
    expect(screen.getByText("Virtual device Tesseract_API_36")).toBeTruthy();
    expect(footerButton("Back").disabled).toBe(true);
    fireEvent.click(footerButton("Cancel"));
    await waitFor(() => expect(calls.cancelled).toBe(1));
  });

  it("follows state events from the main process", async () => {
    const state = androidState();
    await setup(state);
    await ready();
    act(() => {
      emitFixtureEvent("onboarding", "state", { ...state, android: { kind: "done", sdkRoot: "/sdk", avd: "Tesseract_API_36", warnings: [] } });
    });
    expect(await screen.findByText(/^Tesseract_API_36 is ready/)).toBeTruthy();
    expect(footerButton("Continue")).toBeTruthy();
    expect(useStatusOverrides.getState().overrides.android).toBe("done");
  });

  it("explains an unsupported host", async () => {
    await setup(androidState({ androidSupport: UNSUPPORTED }), { android: { support: () => UNSUPPORTED } });
    expect(await screen.findByText(UNSUPPORTED.reason, {}, { timeout: READY_TIMEOUT_MS })).toBeTruthy();
    expect(footerButton("Continue")).toBeTruthy();
  });

  it("offers a retry when the catalog fails", async () => {
    let fail = true;
    await setup(androidState(), {
      onboarding: {
        androidCatalog: async () => {
          if (fail) throw new IpcError("unavailable", "offline");
          const { CATALOG } = await import("../../fixtures/onboarding-android/data");
          return CATALOG;
        },
      },
    });
    expect(await screen.findByText("Couldn't load Google's package list: offline", {}, { timeout: READY_TIMEOUT_MS })).toBeTruthy();
    expect(footerButton("Install").disabled).toBe(true);
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await ready();
  });
});
