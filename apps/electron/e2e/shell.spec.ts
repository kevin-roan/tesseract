import { expect, test } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./app";

let launched: LaunchedApp;

test.afterEach(async () => {
  await launched?.close();
});

test("opens the main shell when onboarding is complete", async () => {
  launched = await launchApp();
  const { window } = launched;
  await expect(window.getByRole("link", { name: "Overview" })).toBeVisible();
  await window.getByRole("link", { name: "Agents" }).click();
  await expect(window).toHaveURL(/#\/agents/);
  await expect(window.getByRole("button", { name: "Close" }).first()).toBeVisible();
});

test("opens settings from the status row", async () => {
  launched = await launchApp();
  const { window } = launched;
  await window.getByTitle("Connection settings").click();
  await expect(window.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(window.locator('[role="dialog"][aria-label="Settings"]:focus-within')).toHaveCount(1);
  await window.keyboard.press("Escape");
  await expect(window.getByRole("dialog", { name: "Settings" })).toBeHidden();
});

test("opens the setup wizard on a fresh profile", async () => {
  launched = await launchApp({ config: {} });
  const { window } = launched;
  await expect(window).toHaveURL(/#\/onboarding\/welcome/);
  await expect(window.getByText("Welcome to Monolith").first()).toBeVisible();
});
