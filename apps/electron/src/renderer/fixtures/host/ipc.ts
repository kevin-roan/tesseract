import { defineIpcFixtures } from "../types";
import { bootHostSimulator, hostIos, hostProxyFixture, linkHostSimulator, shutdownHostSimulator } from "./data";

export default defineIpcFixtures({
  hostShell: {
    request: (_id, request) => hostProxyFixture(request),
    abort: () => undefined,
    iosStatus: () => hostIos(),
    bootSimulator: (udid) => bootHostSimulator(udid),
    shutdownSimulator: () => shutdownHostSimulator(),
    linkIosSandbox: (sandboxUrl) => linkHostSimulator(sandboxUrl),
  },
});
