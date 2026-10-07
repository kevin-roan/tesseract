import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createQueryClient } from "../../app/query-client";
import { useToastStore } from "../../components/Toast";
import { resetFilesStore } from "../../features/files/store";
import { SCENARIOS } from "../../fixtures/files/http";
import { renderRoutes } from "../../test/render";
import FilesPage from "./FilesPage";

function renderPage(path = "/files") {
  return renderRoutes([{ path: "/:pageId/*", element: <FilesPage /> }], path);
}

function setScenario(name: string | null) {
  window.history.replaceState(null, "", name ? `/?scenario=${name}` : "/");
}

describe("FilesPage", () => {
  let skip: boolean | undefined;
  beforeAll(() => {
    skip = MotionGlobalConfig.skipAnimations;
    MotionGlobalConfig.skipAnimations = true;
  });
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = skip;
  });
  afterEach(() => {
    setScenario(null);
    resetFilesStore();
  });

  it("lists shared files grouped by project", async () => {
    renderPage();
    expect(await screen.findByText("SHIFT_MANAGER_SESSION_REPORT_PRINT.md")).toBeTruthy();
    expect(screen.getByText("index.html")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "hybrid-pos" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "best-html" })).toBeTruthy();
    expect(screen.getAllByText("Shared by Claude").length).toBe(2);
    expect(screen.getByText(/10\.4 KB · file · 47m ago/)).toBeTruthy();
    const tabs = screen.getByRole("tablist", { name: "Files view" });
    await waitFor(() => expect(within(tabs).getByRole("tab", { name: /Project builds/ }).textContent).toContain("3"));
    expect(screen.getByRole("button", { name: "Filter by source" })).toBeTruthy();
  });

  it("switches to project builds", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: /Project builds/ }));
    expect(await screen.findByText("app-release.apk")).toBeTruthy();
    expect(screen.getByText("apps/mobile/android/app/build/outputs/apk/release")).toBeTruthy();
    expect(screen.getByText("KenzErp POS Setup 1.1.111.exe")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Filter by source" })).toBeNull();
  });

  it("opens the builds view from the sub-route", async () => {
    renderPage("/files/builds");
    expect(await screen.findByText("native-debug-symbols.zip")).toBeTruthy();
  });

  it("deletes a file after confirmation", async () => {
    renderPage();
    await screen.findByText("index.html");
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]!);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete index.html?")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("index.html")).toBeNull());
    expect(useToastStore.getState().queue.some((toast) => toast.message === "Deleted index.html")).toBe(true);
  });

  it("offers Taildrop only when it is available", async () => {
    renderPage();
    await screen.findByText("index.html");
    expect(screen.queryByRole("button", { name: "Send to device" })).toBeNull();
  });

  it("sends a file with Taildrop", async () => {
    setScenario(SCENARIOS.taildrop);
    renderPage();
    await screen.findByText("index.html");
    const send = await screen.findAllByRole("button", { name: "Send to device" });
    fireEvent.click(send[0]!);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Device" }).textContent).toContain("MacBook-Air · macOS");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(useToastStore.getState().queue.some((toast) => toast.message.startsWith("Sent SHIFT_MANAGER_SESSION_REPORT_PRINT.md to MacBook-Air"))).toBe(true),
    );
  });

  it("shows the first-load error with a retry", async () => {
    setScenario(SCENARIOS.error);
    renderPage();
    expect(await screen.findByText("Couldn't load files")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("shows empty states", async () => {
    setScenario(SCENARIOS.empty);
    renderPage();
    expect(await screen.findByText("No files yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Project builds/ }));
    expect(await screen.findByText("No builds found")).toBeTruthy();
  });

  it("keeps files and filters across remounts", async () => {
    const queryClient = createQueryClient();
    const mount = () =>
      render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={createMemoryRouter([{ path: "/:pageId/*", element: <FilesPage /> }], { initialEntries: ["/files"] })} />
        </QueryClientProvider>,
      );
    const first = mount();
    fireEvent.click(await screen.findByRole("tab", { name: /Project builds/ }));
    expect(await screen.findByText("app-release.apk")).toBeTruthy();
    first.unmount();
    mount();
    expect(screen.queryByText("Loading files…")).toBeNull();
    expect(screen.getByText("app-release.apk")).toBeTruthy();
  });

  it("handles navigation params once", async () => {
    const queryClient = createQueryClient();
    const entry = { pathname: "/files", state: { params: { view: "builds" }, at: 7 } };
    const mount = () =>
      render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={createMemoryRouter([{ path: "/:pageId/*", element: <FilesPage /> }], { initialEntries: [entry] })} />
        </QueryClientProvider>,
      );
    const first = mount();
    expect(await screen.findByText("app-release.apk")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Shared files/ }));
    expect(await screen.findByText("index.html")).toBeTruthy();
    first.unmount();
    mount();
    expect(await screen.findByText("index.html")).toBeTruthy();
    expect(screen.queryByText("app-release.apk")).toBeNull();
  });
});
