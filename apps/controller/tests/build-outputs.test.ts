import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { BuildOutputListSchema, restPaths, type BuildOutput } from "@theone/protocol";
import { isBuildOutputPath } from "../src/services/build-outputs";
import { removeTempDirs, startTestController, writeFiles, type TestController } from "./helpers";

const APK = "android/app/build/outputs/apk/release/app-release.apk";

let t: TestController;

beforeAll(async () => {
  t = await startTestController();
  writeFiles(t.workspace, {
    [`projects/mobile/${APK}`]: "apk-bytes",
    "projects/mobile/android/app/build/intermediates/apk/app.apk": "intermediate",
    "projects/mobile/node_modules/pkg/dist/bundle.zip": "dependency",
    "projects/mobile/assets/fixture.zip": "not a build",
    "projects/mobile/.env": "SECRET=1",
    "projects/desk/release/build/Desk Setup 1.0.0.exe": "exe-bytes",
    "projects/desk/release/build/__uninstaller-nsis-desk.exe": "helper",
    "projects/desk/release/build/win-unpacked/Desk.exe": "unpacked",
    "projects/desk/dist/Desk-1.0.0.AppImage": "appimage-bytes",
  });
  symlinkSync(join(t.workspace, "projects/mobile/.env"), join(t.workspace, "projects/desk/dist/leak.zip"));
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("isBuildOutputPath", () => {
  test("accepts deliverables under output folders only", () => {
    expect(isBuildOutputPath(APK)).toBe(true);
    expect(isBuildOutputPath("release/build/App Setup.exe")).toBe(true);
    expect(isBuildOutputPath("out/make/zip/linux/x64/app.zip")).toBe(true);
    expect(isBuildOutputPath("dist/app.tar.gz")).toBe(true);
    expect(isBuildOutputPath("assets/fixture.zip")).toBe(false);
    expect(isBuildOutputPath("dist/index.js")).toBe(false);
    expect(isBuildOutputPath("node_modules/x/dist/a.zip")).toBe(false);
    expect(isBuildOutputPath("dist/win-unpacked/App.exe")).toBe(false);
    expect(isBuildOutputPath("dist/__uninstaller-nsis.exe")).toBe(false);
    expect(isBuildOutputPath("../other/dist/a.apk")).toBe(false);
    expect(isBuildOutputPath(".git/dist/a.apk")).toBe(false);
  });
});

describe("GET /v1/outputs", () => {
  test("lists deliverables across projects", async () => {
    const { status, body } = await t.json("GET", restPaths.buildOutputs());
    expect(status).toBe(200);
    const outputs = BuildOutputListSchema.parse(body);
    expect(outputs.map((output) => `${output.projectId}/${output.path}`).sort()).toEqual([
      "desk/dist/Desk-1.0.0.AppImage",
      "desk/release/build/Desk Setup 1.0.0.exe",
      `mobile/${APK}`,
    ]);
    const apk = outputs.find((output) => output.projectId === "mobile")!;
    expect(apk).toMatchObject({ fileName: "app-release.apk", sizeBytes: 9, platform: "android" });
  });

  test("filters by project and rejects unknown ones", async () => {
    const { body } = await t.json<BuildOutput[]>("GET", restPaths.buildOutputs({ projectId: "desk" }));
    expect(body.every((output) => output.projectId === "desk")).toBe(true);
    expect((await t.json("GET", restPaths.buildOutputs({ projectId: "missing" }))).status).toBe(404);
  });
});

describe("GET /v1/projects/:id/outputs/download", () => {
  test("streams a listed output with a one-time ticket", async () => {
    const ticket = await t.ticket();
    const url = `${t.baseUrl}${restPaths.buildOutputDownload("mobile", { path: APK, ticket })}`;
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/vnd.android.package-archive");
    expect(response.headers.get("content-disposition")).toContain('filename="app-release.apk"');
    expect(await response.text()).toBe("apk-bytes");
    expect((await fetch(url)).status).toBe(401);
  });

  test("refuses files that are not build outputs", async () => {
    for (const path of [".env", "assets/fixture.zip", "android/app/build/intermediates/apk/app.apk", "../desk/dist/Desk-1.0.0.AppImage"]) {
      const response = await t.request("GET", restPaths.buildOutputDownload("mobile", { path }));
      expect(response.status).toBe(404);
    }
    const leak = await t.request("GET", restPaths.buildOutputDownload("desk", { path: "dist/leak.zip" }));
    expect(leak.status).toBe(404);
  });
});
