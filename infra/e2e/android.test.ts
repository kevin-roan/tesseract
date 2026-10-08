import { describe, expect, test } from "bun:test";
import { ApiError } from "@tesseract/client";
import { client, MINUTES, SECONDS } from "./lib/env";
import { sh } from "./lib/sandbox";
import { waitFor } from "./lib/wait";

const PROJECT_ID = "android-hello";
const ENABLED = process.env.TESSERACT_E2E_ANDROID === "1";
const BUILD_TIMEOUT_MS = 45 * MINUTES;

describe.skipIf(!ENABLED)("android-apk (TESSERACT_E2E_ANDROID=1)", () => {
  test(
    "a blank Expo app builds a debug APK",
    async () => {
      try {
        await client.createProject({ name: PROJECT_ID });
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 409)) throw error;
      }
      await sh(
        [
          "set -e",
          "rm -rf /tmp/tesseract-e2e-android",
          "mkdir -p /tmp/tesseract-e2e-android",
          "cd /tmp/tesseract-e2e-android",
          `bunx create-expo-app@latest ${PROJECT_ID} --template blank-typescript --no-install --yes > create.log 2>&1 || { tail -20 create.log; exit 1; }`,
          `cp -a ${PROJECT_ID}/. /workspace/projects/${PROJECT_ID}/`,
          "rm -rf /tmp/tesseract-e2e-android",
        ].join("\n"),
      );
      const project = await client.getProject(PROJECT_ID);
      expect(project.framework).toBe("expo");
      expect(project.buildTargets).toContain("android-apk");

      const started = await client.startBuild({ projectId: PROJECT_ID, target: "android-apk", profile: "debug" });
      const build = await waitFor(
        "android build",
        async () => {
          const current = await client.getBuild(started.id);
          return current.state === "queued" || current.state === "running" ? undefined : current;
        },
        BUILD_TIMEOUT_MS,
        10 * SECONDS,
      );
      if (build.state !== "succeeded") {
        const tail = (await client.buildLogs(build.id, { tail: 80 })).map((line) => line.text).join("\n");
        throw new Error(`android build ${build.state}: ${build.error}\n${tail}`);
      }
      const [artifact] = build.artifacts;
      expect(artifact?.fileName).toMatch(/^android-hello-android-debug-1\.0\.0(-\d+)?\.apk$/);
      expect(artifact?.platform).toBe("android");
      const badging = await sh(`/opt/android-sdk/build-tools/*/aapt dump badging ${artifact?.path} | head -1`);
      expect(badging).toContain("package: name=");
    },
    BUILD_TIMEOUT_MS + 5 * MINUTES,
  );
});
