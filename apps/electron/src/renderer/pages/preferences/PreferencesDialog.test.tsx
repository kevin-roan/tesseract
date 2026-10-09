import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { useLocation } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AppSettings } from "../../../shared/contracts/app";
import { DEFAULT_SETTINGS } from "../../../shared/defaults";
import { resetConnectionRuntime } from "../../app/connection";
import { useToastStore } from "../../components/Toast";
import { overrideIpcFixtures } from "../../fixtures";
import { renderRoutes } from "../../test/render";
import { PreferencesDialog } from "./PreferencesDialog";
import { nextSectionId } from "./use-preferences-dialog";

function Location() {
  return <output data-testid="location">{useLocation().search}</output>;
}

const routes = [
  {
    path: "*",
    element: (
      <>
        <PreferencesDialog />
        <Location />
      </>
    ),
  },
];

let restore: (() => void) | null = null;

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

afterEach(() => {
  restore?.();
  restore = null;
  resetConnectionRuntime();
  useToastStore.setState({ queue: [] });
});

describe("nextSectionId", () => {
  it("moves through the sections and clamps at the ends", () => {
    expect(nextSectionId("connection", "ArrowDown")).toBe("appearance");
    expect(nextSectionId("connection", "ArrowUp")).toBe("connection");
    expect(nextSectionId("appearance", "End")).toBe("about");
    expect(nextSectionId("stt", "Home")).toBe("connection");
    expect(nextSectionId("stt", "x")).toBeNull();
  });
});

describe("PreferencesDialog", () => {
  it("opens on the requested section and switches from the nav", async () => {
    renderRoutes(routes, "/overview?preferences=appearance");
    const dialog = await screen.findByRole("dialog", { name: "Settings" });
    expect(await within(dialog).findByText("Choose how Tesseract looks on this computer.")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Appearance" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Speech-to-text" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("?preferences=stt"));
    expect(await screen.findByText("Resource usage")).toBeTruthy();
  });

  it("falls back to the first section and closes on Escape", async () => {
    renderRoutes(routes, "/overview?preferences=nope");
    expect(await screen.findByText("Sandbox controller")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByTestId("location").textContent).toBe("");
  });

  it("moves the selection with the arrow keys", async () => {
    renderRoutes(routes, "/overview?preferences=connection");
    const tab = await screen.findByRole("tab", { name: "Connection" });
    fireEvent.keyDown(tab, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("?preferences=appearance"));
  });

  it("saves the appearance only when it changes", async () => {
    const patches: Partial<AppSettings>[] = [];
    restore = overrideIpcFixtures({
      app: {
        settings: () => DEFAULT_SETTINGS,
        updateSettings: (patch) => {
          patches.push(patch);
          return { ...DEFAULT_SETTINGS, ...patch };
        },
      },
    });
    renderRoutes(routes, "/overview?preferences=appearance");
    const dark = await screen.findByRole("radio", { name: /Dark/ });
    await waitFor(() => expect(dark.getAttribute("aria-checked")).toBe("true"));
    fireEvent.click(dark);
    fireEvent.click(screen.getByRole("radio", { name: /Light/ }));
    await waitFor(() => expect(patches).toEqual([{ appearance: "light" }]));
    await waitFor(() => expect(screen.getByRole("radio", { name: /Light/ }).getAttribute("aria-checked")).toBe("true"));
  });

  it("loads the sandbox speech-to-text status and changes the profile", async () => {
    renderRoutes(routes, "/overview?preferences=stt");
    expect(await screen.findByText("whisper.cpp", {}, { timeout: 3000 })).toBeTruthy();
    const eco = screen.getByRole("radio", { name: /^Eco/ });
    expect(eco.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /^Balanced/ }));
    expect(await screen.findByText("Speech-to-text set to Balanced")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /^Balanced/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("shows host Claude accounts with the first one expanded", async () => {
    renderRoutes(routes, "/overview?preferences=claude");
    expect(await screen.findByText("you@example.com · Example Org")).toBeTruthy();
    const expanders = screen.getByRole("tabpanel", { name: "Claude" }).querySelectorAll("[aria-expanded]");
    expect([...expanders].map((node) => node.getAttribute("aria-expanded"))).toEqual(["true", "false"]);
    expect(screen.queryByText("work@example.com · Example Work")).toBeNull();
  });

  it("refuses to save an invalid connection", async () => {
    renderRoutes(routes, "/overview?preferences=connection");
    const url = await screen.findByRole("textbox", { name: "API URL" });
    fireEvent.change(url, { target: { value: "not a url" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & connect" }));
    expect(await screen.findByText("Enter a valid http(s) URL and a token")).toBeTruthy();
  });

  it("opens phone pairing from the connection section", async () => {
    renderRoutes(routes, "/overview?preferences=connection");
    fireEvent.click(await screen.findByRole("button", { name: "Show QR…" }));
    expect(await screen.findByText("Pair a device")).toBeTruthy();
  });
});
