import { defineIpcFixtures } from "../types";
import { bootHostSimulator, hostIos, hostProxyFixture, linkHostSimulator, shutdownHostSimulator } from "./data";

export default defineIpcFixtures({
  hostShell: {
    request: (_id, request) => hostProxyFixture(request),
    abort: () => undefined,
    openTerminal: () => undefined,
    openWorkspace: (projectId) => ({ projectId, apiUrl: "http://127.0.0.1:7702", token: "fixture-host-workspace", name: "fixture (host)" }),
    iosStatus: () => hostIos(),
    bootSimulator: (udid) => bootHostSimulator(udid),
    shutdownSimulator: () => shutdownHostSimulator(),
    linkIosSandbox: (sandboxUrl) => linkHostSimulator(sandboxUrl),
  },
});
