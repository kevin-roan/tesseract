import { defineSocketFixtures } from "../types";
import { PROTECTED_PROCESS_IDS, logLines } from "./data";

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const skipped = PROTECTED_PROCESS_IDS.map((id) => `(?!${escape(id)}/)`).join("");
const PROCESS_STREAM = new RegExp(`^/v1/processes/${skipped}[^/]+/logs/stream$`);
const BUILD_STREAM = /^\/v1\/builds\/[^/]+\/logs\/stream$/;

const frames = (kind: "process" | "build") => logLines(kind).map((line) => ({ type: "log", line }));

export default defineSocketFixtures([
  { path: PROCESS_STREAM, frames: () => frames("process") },
  { path: BUILD_STREAM, frames: () => frames("build") },
]);
