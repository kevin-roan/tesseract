import { expect, test } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./app";

let launched: LaunchedApp;

test.afterEach(async () => {
  await launched?.close();
});

test("switches settings pages and applies the theme", async () => {
  launched = await launchApp();
  const { window } = launched;
  await window.getByTitle("Connection settings").click();
  const dialog = window.getByRole("dialog", { name: "Settings" });
  await expect(dialog.getByText("Sandbox controller")).toBeVisible();
  await dialog.getByRole("tab", { name: "Appearance" }).click();
  await expect(window).toHaveURL(/preferences=appearance/);
  await dialog.getByRole("radio", { name: /Light/ }).click();
  await expect(window.locator("html")).toHaveAttribute("data-scheme", "graphiteLight");
  await dialog.getByRole("radio", { name: /Dark/ }).click();
  await expect(window.locator("html")).toHaveAttribute("data-scheme", "graphite");
});

test("changes the speech-to-text profile", async () => {
  launched = await launchApp();
  const { window } = launched;
  await window.getByTitle("Connection settings").click();
  const dialog = window.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("tab", { name: "Speech-to-text" }).click();
  const balanced = dialog.getByRole("radio", { name: /^Balanced/ });
  await expect(balanced).toBeEnabled();
  await balanced.click();
  await expect(dialog.getByText("Speech-to-text set to Balanced")).toBeVisible();
  await expect(balanced).toHaveAttribute("aria-checked", "true");
});

test("shows the Claude accounts of this computer", async () => {
  launched = await launchApp();
  const { window } = launched;
  await window.getByTitle("Connection settings").click();
  const dialog = window.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("tab", { name: "Claude" }).click();
  await expect(dialog.getByText("you@example.com · Example Org")).toBeVisible();
  await dialog.getByText("claude-work", { exact: true }).first().click();
  await expect(dialog.getByText("work@example.com · Example Work")).toBeVisible();
});
