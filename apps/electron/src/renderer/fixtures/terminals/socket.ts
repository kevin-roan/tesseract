import { routePatterns } from "@tesseract/protocol";
import { currentScenario } from "../scenario";
import { defineSocketFixtures } from "../types";
import { FIXTURE_EXIT_CODE, fixtureScreen, TERMINAL_SCENARIOS } from "./data";

const STREAM_PATH = new RegExp(`^${routePatterns.ws.terminalStream.replace(":id", "([^/]+)")}$`);

export default defineSocketFixtures([
  {
    path: STREAM_PATH,
    frames: (url) => {
      const id = decodeURIComponent(STREAM_PATH.exec(url.pathname)?.[1] ?? "");
      const output = { type: "output", data: fixtureScreen(id) };
      return currentScenario() === TERMINAL_SCENARIOS.exited ? [output, { type: "exit", code: FIXTURE_EXIT_CODE }] : [output];
    },
  },
]);
