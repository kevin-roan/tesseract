import { cleanup, configure } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach } from "vitest";

const ASYNC_UTIL_TIMEOUT_MS = 8_000;

MotionGlobalConfig.skipAnimations = true;
configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT_MS });

afterEach(() => {
  cleanup();
});
