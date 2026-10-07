import { wsPaths } from "@theone/protocol";
import { defineSocketFixtures } from "../types";
import { FIXTURE_SANDBOX } from "./data";

export default defineSocketFixtures([
  { path: wsPaths.events(), frames: () => [{ type: "hello", protocolVersion: 1, sandboxId: FIXTURE_SANDBOX }] },
]);
