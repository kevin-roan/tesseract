import { buildPairingLink, HOST_PAIRING_ACTION } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import type { ConnectionConfig } from "../../shared/contracts/connection";
import { connectionFromJson } from "../config";
import { readMasterHost } from "../master-host/model";
import { MACHINES_KEY } from "./constants";
import {
  findMachine,
  isLocalMachine,
  linkMachineHost,
  listMachines,
  markLocalMachine,
  probeMachineStatuses,
  releaseMachine,
  rememberMachine,
  renameMachine,
  sameStatuses,
  storeMachine,
} from "./machines";
import { resolveConnectionInput } from "./pairing";

const LOCAL: ConnectionConfig = {
  apiUrl: "http://172.18.0.2:7700",
  token: "local-token",
  name: "tesseract",
  pairingUrl: "https://sb.ts.net",
  source: "docker",
};
const OFFICE = { apiUrl: "https://office.ts.net", token: "office-token", name: "Office", pairingUrl: null };
const MAC = { url: "https://mac.ts.net:8443", token: "host-token", name: "Mac" };
const LOCAL_HOST = { url: "http://127.0.0.1:7701", name: "laptop" };

describe("machine list", () => {
  it("always lists the discovered local sandbox first, unnamed and with the local host", () => {
    const data = rememberMachine({}, OFFICE, null);
    const active = { ...OFFICE, source: "file" as const };
    const list = listMachines(data, active, { local: LOCAL, localHost: LOCAL_HOST, statuses: { [OFFICE.apiUrl]: "online" } });
    expect(list).toEqual([
      { id: LOCAL.apiUrl, apiUrl: LOCAL.apiUrl, name: null, active: false, local: true, status: "unknown", host: LOCAL_HOST },
      { id: OFFICE.apiUrl, apiUrl: OFFICE.apiUrl, name: "Office", active: true, local: false, status: "online", host: null },
    ]);
  });

  it("shows an active discovered sandbox once, as local", () => {
    const list = listMachines({}, LOCAL, { local: LOCAL });
    expect(list.map((item) => [item.id, item.active, item.local, item.name])).toEqual([[LOCAL.apiUrl, true, true, null]]);
  });

  it("reports each remote machine's linked host without its token", () => {
    const data = storeMachine({}, OFFICE, { activate: false, local: false, host: MAC, sealWith: null });
    const [office] = listMachines(data, null);
    expect(office).toMatchObject({ id: OFFICE.apiUrl, active: false, host: { url: MAC.url, name: "Mac" } });
    expect(JSON.stringify(office)).not.toContain(MAC.token);
  });
});

describe("storing machines", () => {
  it("adds without activating, or activates into the flat keys", () => {
    const added = storeMachine({ zoom: 1 }, OFFICE, { activate: false, local: false, sealWith: null });
    expect(connectionFromJson(added, "file")).toBeNull();
    expect(findMachine(added, OFFICE.apiUrl, null)?.token).toBe(OFFICE.token);
    const active = storeMachine({}, OFFICE, { activate: true, local: false, sealWith: null });
    expect(connectionFromJson(active, "file")?.apiUrl).toBe(OFFICE.apiUrl);
  });

  it("stores the host link with the machine and unlinks it", () => {
    let data = storeMachine({}, OFFICE, { activate: true, local: false, host: MAC, sealWith: null });
    expect(readMasterHost(data, OFFICE.apiUrl, null)).toEqual(MAC);
    const other = { url: "https://linux.ts.net:8443", token: "t2", name: null };
    data = linkMachineHost(data, OFFICE.apiUrl, other, null);
    expect(readMasterHost(data, OFFICE.apiUrl, null)).toEqual(other);
    data = linkMachineHost(data, OFFICE.apiUrl, null, null);
    expect(readMasterHost(data, OFFICE.apiUrl, null)).toBeNull();
    expect(listMachines(data, null)[0]?.host).toBeNull();
  });

  it("keeps the local machine's own name instead of the controller's", () => {
    let data = rememberMachine({}, LOCAL, null, { local: true });
    expect(listMachines(data, null)[0]?.name).toBeNull();
    data = renameMachine(data, LOCAL.apiUrl, "Desk");
    data = rememberMachine(data, { ...LOCAL, token: "rotated" }, null);
    expect(listMachines(data, null)[0]).toMatchObject({ name: "Desk", local: true });
    expect(findMachine(data, LOCAL.apiUrl, null)?.token).toBe("rotated");
  });

  it("marks a saved entry local once discovery finds it", () => {
    const data = rememberMachine({}, LOCAL, null);
    expect(isLocalMachine({ apiUrl: LOCAL.apiUrl }, data)).toBe(false);
    const marked = markLocalMachine(data, LOCAL.apiUrl);
    expect(isLocalMachine({ apiUrl: LOCAL.apiUrl }, marked)).toBe(true);
    expect(markLocalMachine(marked, LOCAL.apiUrl)).toBe(marked);
    expect(isLocalMachine({ apiUrl: "http://localhost:7700" }, {})).toBe(true);
    expect(isLocalMachine({ apiUrl: OFFICE.apiUrl }, {}, { ...LOCAL, apiUrl: OFFICE.apiUrl })).toBe(true);
  });

  it("releasing the local machine clears its token but keeps it listed", () => {
    let data = rememberMachine(rememberMachine({}, LOCAL, null, { local: true }), OFFICE, null);
    data = releaseMachine(data, LOCAL.apiUrl);
    expect(findMachine(data, LOCAL.apiUrl, null)).toBeNull();
    expect(JSON.stringify(data)).not.toContain(LOCAL.token);
    expect(listMachines(data, null).map((item) => [item.id, item.local])).toEqual([
      [LOCAL.apiUrl, true],
      [OFFICE.apiUrl, false],
    ]);
    data = releaseMachine(data, OFFICE.apiUrl);
    expect(data[MACHINES_KEY]).toEqual([{ url: LOCAL.apiUrl, pairingUrl: LOCAL.pairingUrl, local: true }]);
  });
});

describe("machine status", () => {
  it("probes every machine and compares results", async () => {
    const calls: [string, number][] = [];
    const statuses = await probeMachineStatuses(["http://a:7700", "http://b:7700", "http://c:7700"], async (url, timeoutMs) => {
      calls.push([url, timeoutMs]);
      if (url === "http://c:7700") throw new Error("boom");
      return url === "http://a:7700";
    });
    expect(statuses).toEqual({ "http://a:7700": "online", "http://b:7700": "offline", "http://c:7700": "offline" });
    expect(calls.every(([, timeout]) => timeout === 2_000)).toBe(true);
    expect(sameStatuses(statuses, { ...statuses })).toBe(true);
    expect(sameStatuses(statuses, { ...statuses, "http://b:7700": "online" })).toBe(false);
    expect(sameStatuses({}, { "http://a:7700": "unknown" })).toBe(true);
  });
});

describe("add input", () => {
  it("accepts a tesseract://pair link in the address", () => {
    const link = buildPairingLink({ url: OFFICE.apiUrl, token: OFFICE.token, name: "Office" });
    expect(resolveConnectionInput({ apiUrl: ` ${link} `, token: "" })).toEqual({
      ok: true,
      value: { apiUrl: OFFICE.apiUrl, token: OFFICE.token, name: "Office", pairingUrl: OFFICE.apiUrl },
    });
    expect(resolveConnectionInput({ apiUrl: link, token: "", name: "Work" })).toMatchObject({ ok: true, value: { name: "Work" } });
  });

  it("rejects host links, garbage and empty tokens", () => {
    const host = buildPairingLink(MAC, HOST_PAIRING_ACTION);
    expect(resolveConnectionInput({ apiUrl: host, token: "" }).ok).toBe(false);
    expect(resolveConnectionInput({ apiUrl: "https://office.ts.net", token: " " }).ok).toBe(false);
    expect(resolveConnectionInput(null as never).ok).toBe(false);
    expect(resolveConnectionInput({ apiUrl: "https://office.ts.net/", token: "t" })).toMatchObject({ ok: true, value: { apiUrl: "https://office.ts.net" } });
  });
});
