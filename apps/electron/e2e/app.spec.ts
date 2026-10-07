import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { TheOneClient } from "@theone/client";
import type { Project } from "@theone/protocol";
import { launchApp, type LaunchedApp } from "./app";
import {
  apiClient,
  assertTestStack,
  compareSnapshot,
  connectionConfig,
  goTo,
  liveStack,
  LIVE_SANDBOX_NAME,
  LIVE_TIMEOUT_MS,
  MAX_MISMATCH_PERCENT,
  OFFLINE_TOKEN,
  OFFLINE_URL,
  plainTerminalText,
  readTerminalOutput,
  SNAPSHOT_ENV,
  stillWindow,
  uniqueName,
  waitIdle,
} from "./app-helpers";

interface SnapshotRoute {
  name: string;
  route: string;
  ready: (window: Page) => ReturnType<Page["getByRole"]>;
  prepare?: (window: Page) => Promise<void>;
}

const PAGES = [
  { id: "overview", title: "Overview" },
  { id: "agents", title: "Agents" },
  { id: "projects", title: "Projects" },
  { id: "files", title: "Files" },
  { id: "terminals", title: "Terminals" },
  { id: "display", title: "Display" },
] as const;

const SNAPSHOT_ROUTES: readonly SnapshotRoute[] = [
  { name: "overview", route: "/overview", ready: (w) => w.getByRole("heading", { name: "Resources" }) },
  { name: "agents", route: "/agents", ready: (w) => w.getByRole("main") },
  { name: "projects", route: "/projects", ready: (w) => w.getByRole("tablist", { name: "Project filter" }) },
  { name: "projects-detail", route: "/projects/monolith", ready: (w) => w.getByRole("tablist", { name: "Project sections" }) },
  { name: "files", route: "/files", ready: (w) => w.getByRole("tablist", { name: "Files view" }) },
  { name: "terminals", route: "/terminals", ready: (w) => w.getByRole("listbox", { name: "Sessions" }) },
  { name: "display", route: "/display", ready: (w) => w.getByRole("toolbar", { name: "Display controls" }) },
  { name: "preferences-connection", route: "/overview?preferences=connection", ready: (w) => w.getByRole("dialog", { name: "Settings" }) },
  { name: "preferences-appearance", route: "/overview?preferences=appearance", ready: (w) => w.getByRole("dialog", { name: "Settings" }) },
  { name: "overview-light", route: "/overview", prepare: useLightScheme, ready: (w) => w.getByRole("heading", { name: "Resources" }) },
];

async function useLightScheme(window: Page): Promise<void> {
  await goTo(window, "/overview?preferences=appearance");
  const dialog = window.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("radio", { name: /Light/ }).click();
  await expect(window.locator("html")).toHaveAttribute("data-scheme", "graphiteLight");
  await window.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}

const PROCESS_COMMAND = "printf 'hello from monolith e2e\\n' > e2e-notes.txt && exec sleep 600";
const NOTES_FILE = "e2e-notes.txt";

test.describe("visual snapshots (fixtures)", () => {
  test.describe.configure({ mode: "serial" });
  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp({ env: { ...SNAPSHOT_ENV } });
    await stillWindow(launched.window);
  });

  test.afterAll(async () => {
    await launched?.close();
  });

  for (const shot of SNAPSHOT_ROUTES) {
    test(`${shot.name} matches its baseline`, async ({}, info) => {
      const { window } = launched;
      await shot.prepare?.(window);
      await goTo(window, shot.route);
      await expect(shot.ready(window).first()).toBeVisible();
      await waitIdle(window);
      const image = await window.screenshot({ animations: "disabled", caret: "hide" });
      const result = compareSnapshot(image, shot.name, info);
      info.annotations.push({ type: "snapshot", description: result.created ? `wrote baseline ${shot.name}.png` : `mismatch ${result.percent.toFixed(3)}%` });
      expect(result.percent, `${shot.name} differs from e2e/__snapshots__/${shot.name}.png`).toBeLessThanOrEqual(MAX_MISMATCH_PERCENT);
    });
  }
});

test.describe("live controller", () => {
  const stack = liveStack();
  test.skip(!stack, "THEONE_E2E_URL and THEONE_E2E_TOKEN are not set (run against the infra/e2e stack)");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  let launched: LaunchedApp;
  let client: TheOneClient;
  let project: Project | null = null;
  const terminalIds: string[] = [];
  const artifactIds: string[] = [];
  const projectName = uniqueName("project");
  const processName = uniqueName("process");

  test.beforeAll(async () => {
    if (!stack) return;
    assertTestStack(stack);
    client = apiClient(stack);
    await client.health();
    launched = await launchApp({ config: connectionConfig(OFFLINE_URL, OFFLINE_TOKEN), env: { MONOLITH_FIXTURES: "0" } });
  });

  test.afterAll(async () => {
    await launched?.close();
    if (!client) return;
    for (const id of terminalIds) await client.closeTerminal(id).catch(() => undefined);
    for (const id of artifactIds) await client.deleteArtifact(id).catch(() => undefined);
    if (project) {
      const processes = await client.listProcesses({ projectId: project.id }).catch(() => []);
      for (const process of processes) {
        if (process.state === "running" || process.state === "starting") await client.stopProcess(process.id).catch(() => undefined);
      }
      await client.deleteProject(project.id, { force: true }).catch(() => undefined);
    }
  });

  const sidebar = () => launched.window.getByRole("complementary").first();
  const main = () => launched.window.getByRole("main");
  const settings = () => launched.window.getByRole("dialog", { name: "Settings" });

  test("connects to the controller from Settings", async () => {
    const { window } = launched;
    const status = sidebar().getByRole("button", { name: new RegExp(`^${LIVE_SANDBOX_NAME}`) });
    await expect(status).toContainText(/Offline|Connecting/, { timeout: LIVE_TIMEOUT_MS });
    await status.click();
    const dialog = settings();
    await expect(dialog.getByText("Sandbox controller")).toBeVisible();
    await dialog.getByRole("textbox", { name: "API URL" }).fill(stack!.url);
    await dialog.getByLabel("Token").fill(stack!.token);
    await dialog.getByRole("textbox", { name: "Display name" }).fill(LIVE_SANDBOX_NAME);
    await dialog.getByRole("button", { name: "Save & connect" }).click();
    await expect(dialog.getByText("Online").first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await window.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(sidebar().getByRole("button", { name: /Online/ })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    const saved = JSON.parse(readFileSync(launched.profile.env.MONOLITH_DESKTOP_CONFIG!, "utf8")) as Record<string, unknown>;
    expect(saved.url).toBe(stack!.url);
  });

  test("navigates every page", async () => {
    const { window } = launched;
    for (const page of PAGES) {
      await sidebar().getByRole("link", { name: new RegExp(`^${page.title}`) }).click();
      await expect(window).toHaveURL(new RegExp(`#/${page.id}`));
      await expect(main().getByText(page.title, { exact: true }).first()).toBeVisible();
    }
  });

  test("shows the sandbox stats on the overview", async () => {
    const { window } = launched;
    await goTo(window, "/overview");
    for (const name of ["CPU load", "Memory", "Disk"]) {
      await expect(main().getByRole("progressbar", { name })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    }
    const activity = main().getByRole("list", { name: "Activity" });
    await expect(activity).toBeVisible();
    await expect
      .poll(async () => {
        const count = (await client.listProjects()).length;
        const text = (await activity.getByRole("listitem").filter({ hasText: /^Projects/ }).first().textContent()) ?? "";
        return text.replace(/\s+/g, "") === `Projects${count}`;
      }, { timeout: LIVE_TIMEOUT_MS })
      .toBe(true);
  });

  test("creates a project", async () => {
    const { window } = launched;
    await goTo(window, "/projects");
    await main().getByRole("button", { name: "New project" }).first().click();
    const dialog = window.getByRole("dialog", { name: "New project" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Name" }).fill(projectName);
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(dialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });
    await expect
      .poll(async () => {
        project = (await client.listProjects()).find((candidate) => candidate.name === projectName) ?? null;
        return project?.id ?? "";
      }, { timeout: LIVE_TIMEOUT_MS })
      .not.toBe("");
    await expect(window).toHaveURL(new RegExp(`#/projects/${project!.id}`));
    await expect(main().getByRole("heading", { level: 1, name: projectName })).toBeVisible();
  });

  test("starts and stops a process", async () => {
    test.skip(!project, "needs the project from the previous test");
    const { window } = launched;
    await goTo(window, `/projects/${project!.id}`);
    await main().getByRole("tab", { name: "Processes" }).click();
    await main().getByRole("button", { name: "Run command" }).click();
    const dialog = window.getByRole("dialog", { name: "Run a command" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Command" }).fill(PROCESS_COMMAND);
    await dialog.getByRole("textbox", { name: "Name (optional)" }).fill(processName);
    await dialog.getByRole("button", { name: "Run", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: LIVE_TIMEOUT_MS });

    const row = main().getByRole("list", { name: "Processes" }).getByRole("listitem").filter({ hasText: processName });
    await expect(row.getByRole("img", { name: "Running" })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await row.hover();
    await row.getByRole("button", { name: "Stop" }).click();
    const confirm = window.getByRole("alertdialog").filter({ has: window.getByRole("heading", { name: `Stop ${processName}?` }) });
    await confirm.getByRole("button", { name: "Stop" }).click();
    await expect(row.getByRole("img", { name: "Stopped" })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    const processes = await client.listProcesses({ projectId: project!.id });
    expect(processes.find((item) => item.name === processName)?.state).toBe("stopped");
  });

  test("opens a terminal and runs echo hi", async () => {
    const { window } = launched;
    const before = new Set((await client.listTerminals()).map((terminal) => terminal.id));
    await goTo(window, "/terminals");
    await main().getByRole("button", { name: "Shell" }).first().click();
    let terminalId = "";
    await expect
      .poll(async () => {
        const created = (await client.listTerminals()).find((terminal) => !before.has(terminal.id) && terminal.kind === "shell");
        terminalId = created?.id ?? "";
        return terminalId;
      }, { timeout: LIVE_TIMEOUT_MS })
      .not.toBe("");
    terminalIds.push(terminalId);
    const input = main().locator(".xterm-helper-textarea");
    await expect(input).toBeAttached({ timeout: LIVE_TIMEOUT_MS });
    await expect(main().getByText("Live").first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await input.focus();
    await window.keyboard.type("echo hi");
    await window.keyboard.press("Enter");
    await expect
      .poll(async () => plainTerminalText(await readTerminalOutput(client, terminalId)), { timeout: LIVE_TIMEOUT_MS })
      .toMatch(/echo hi\nhi\n/);
  });

  test("lists shared files", async () => {
    test.skip(!project, "needs the project and its process output");
    const { window } = launched;
    const artifact = await client.shareArtifact({ path: `${project!.path}/${NOTES_FILE}`, projectId: project!.id });
    artifactIds.push(artifact.id);
    await goTo(window, "/files");
    await main().getByRole("tab", { name: /Shared files/ }).click();
    await main().getByRole("button", { name: "Refresh" }).click();
    await expect(main().getByText(artifact.fileName).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
  });

  test("renders the sandbox display over VNC", async () => {
    const { window } = launched;
    await goTo(window, "/display");
    const toolbar = main().getByRole("toolbar", { name: "Display controls" });
    await expect(toolbar.getByText("Live", { exact: true })).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    const canvas = main().getByRole("region", { name: "Sandbox display" }).locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: LIVE_TIMEOUT_MS });
    await expect
      .poll(
        () =>
          canvas.evaluate((node) => {
            const element = node as unknown as { width: number; height: number; getContext(type: "2d"): { getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray } } | null };
            const context = element.getContext("2d");
            if (!context || element.width === 0 || element.height === 0) return 0;
            const { data } = context.getImageData(0, 0, element.width, element.height);
            const colors = new Set<number>();
            for (let index = 0; index < data.length && colors.size < 8; index += 4 * 97) colors.add((data[index]! << 16) | (data[index + 1]! << 8) | data[index + 2]!);
            return colors.size;
          }),
        { timeout: LIVE_TIMEOUT_MS },
      )
      .toBeGreaterThan(1);
  });

  test("saves preferences", async () => {
    const { window } = launched;
    const renamed = `${LIVE_SANDBOX_NAME} e2e`;
    await sidebar().getByRole("button", { name: new RegExp(`^${LIVE_SANDBOX_NAME}.*Online`) }).click();
    const dialog = settings();
    await dialog.getByRole("tab", { name: "Connection" }).click();
    await dialog.getByRole("textbox", { name: "Display name" }).fill(renamed);
    await dialog.getByRole("button", { name: "Save & connect" }).click();
    await expect(window.getByText("Connection saved").first()).toBeVisible();
    await expect
      .poll(() => (JSON.parse(readFileSync(launched.profile.env.MONOLITH_DESKTOP_CONFIG!, "utf8")) as Record<string, unknown>).name)
      .toBe(renamed);
    await window.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await sidebar().getByRole("button", { name: new RegExp(`^${LIVE_SANDBOX_NAME}.*Online`) }).click();
    await expect(dialog.getByRole("textbox", { name: "Display name" })).toHaveValue(renamed);
    await window.keyboard.press("Escape");
  });
});
