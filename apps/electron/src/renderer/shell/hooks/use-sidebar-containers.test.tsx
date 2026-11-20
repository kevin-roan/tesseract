import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ServerContainer } from "../../../shared/contracts/containers";
import type { MasterHostState } from "../../../shared/contracts/masterHost";
import { hostFixtureState } from "../../fixtures/host/data";
import { overrideIpcFixtures } from "../../fixtures/registry";
import { renderRoutes } from "../../test/render";
import { useSidebarContainers } from "./use-sidebar-containers";

const container = (name: string) => ({ name, id: name, state: "running", status: "Up", image: "i", createdAt: "", cpus: null, memoryMb: null, tailnet: null, tunnel: "none", autoDeploy: false }) satisfies ServerContainer;
const linked: MasterHostState = { kind: "linked", sandboxUrl: "https://mac.ts.net", host: { link: "tesseract://host", url: "https://mac.ts.net:8443", name: "mac", online: true } };

function Probe() {
  const { state, items } = useSidebarContainers();
  return <p>{`${state}:${items.map((item) => item.name).join(",")}`}</p>;
}

describe("useSidebarContainers", () => {
  let restore = () => undefined as void;
  afterEach(() => restore());

  function setup(master: MasterHostState, sessionExpiresAt: number | null, names: string[]) {
    restore = overrideIpcFixtures({
      masterHost: { state: () => master },
      hostShell: { state: () => hostFixtureState({ sessionExpiresAt }) },
      containers: { list: () => names.map(container), report: () => { throw new Error("no report"); } },
    });
    renderRoutes([{ path: "/", element: <Probe /> }], "/");
  }

  it("shows this computer's containers on a local machine, locked or not", async () => {
    setup({ kind: "local" }, null, ["local-one"]);
    expect(await screen.findByText(/^ready:local-one/)).toBeTruthy();
  });

  it("hides the list while a server's host is locked", async () => {
    setup(linked, null, ["local-one"]);
    await waitFor(() => expect(screen.getByText(/^locked:/)).toBeTruthy());
  });

  it("never mixes this computer's list into a locked server", async () => {
    setup(linked, null, ["local-one"]);
    await screen.findByText(/^locked:/);
    expect(screen.queryByText(/local-one/)).toBeNull();
  });

  it("shows the server's containers once its host is unlocked", async () => {
    setup(linked, Date.now() + 60_000, ["mac-one"]);
    expect(await screen.findByText(/^ready:mac-one/)).toBeTruthy();
  });
});
