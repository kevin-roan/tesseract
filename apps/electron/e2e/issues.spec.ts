import { expect, test } from "@playwright/test";
import { launchApp, type LaunchedApp } from "./app";
import { goTo, SNAPSHOT_ENV } from "./app-helpers";

test.describe("project issues (fixtures)", () => {
  test.describe.configure({ mode: "serial" });
  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp({ env: { ...SNAPSHOT_ENV } });
  });

  test.afterAll(async () => {
    await launched?.close();
  });

  const main = () => launched.window.getByRole("main");
  const board = () => main().getByRole("group", { name: "Issue board" });

  test("shows the board and opens an issue", async () => {
    await goTo(launched.window, "/projects/tesseract?tab=issues");
    await expect(board()).toBeVisible();
    const inProgress = board().getByRole("region", { name: "In Progress" });
    await inProgress.getByRole("button", { name: /^TESSERACT-3 / }).click();
    const sheet = launched.window.getByRole("dialog", { name: "TESSERACT-3" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Run Claude now" })).toBeDisabled();
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
  });

  test("creates an issue for Claude with the c shortcut", async () => {
    await expect(board()).toBeVisible();
    await launched.window.keyboard.press("c");
    const dialog = launched.window.getByRole("dialog", { name: /New issue/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Title" }).fill("Write the e2e issue");
    await dialog.getByRole("switch", { name: "Assign to Claude" }).click();
    await dialog.getByRole("button", { name: "Create issue" }).click();
    await expect(dialog).toBeHidden();
    await expect(board().getByRole("region", { name: "Todo" }).getByRole("button", { name: /Write the e2e issue/ })).toBeVisible();
  });
});
