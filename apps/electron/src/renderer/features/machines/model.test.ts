import { buildPairingLink, HOST_PAIRING_ACTION } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import type { SavedMachine } from "../../../shared/contracts/connection";
import { MACHINE_LABELS } from "./labels";
import { activeMachine, EMPTY_ADD_MACHINE_FORM, machineLabel, machineRow, readAddMachineForm, type AddMachineForm } from "./model";

const PAIR_LINK = "tesseract://pair?url=https%3A%2F%2Fsb.ts.net&token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG&name=rig";
const HOST_LINK = buildPairingLink({ url: "https://mac.ts.net:7701", token: "host-token", name: "mac" }, HOST_PAIRING_ACTION);

const machine = (patch: Partial<SavedMachine> = {}): SavedMachine => ({
  id: "https://office.ts.net:7700",
  apiUrl: "https://office.ts.net:7700",
  name: null,
  active: false,
  local: false,
  status: "unknown",
  host: null,
  ...patch,
});

const form = (patch: Partial<AddMachineForm>): AddMachineForm => ({ ...EMPTY_ADD_MACHINE_FORM, ...patch });

describe("machines model", () => {
  it("labels a machine by name, then this computer, then host", () => {
    expect(machineLabel({ apiUrl: "https://office.ts.net", name: "office" })).toBe("office");
    expect(machineLabel({ apiUrl: "https://office.ts.net:7700", name: null })).toBe("office.ts.net:7700");
    expect(machineLabel({ apiUrl: "http://127.0.0.1:7700", name: null, local: true })).toBe(MACHINE_LABELS.thisComputer);
  });

  it("builds menu rows with status, host link and removability", () => {
    const remote = machineRow(machine({ status: "online", host: { url: "https://mac.ts.net:7701", name: "mac" } }));
    expect(remote).toMatchObject({ label: "office.ts.net:7700", detail: "office.ts.net:7700", tone: "success", statusLabel: "Online", removable: true });
    expect(remote.hostLabel).toBe(MACHINE_LABELS.hostLinked("mac"));
    const local = machineRow(machine({ apiUrl: "http://127.0.0.1:7700", name: "arch", local: true, status: "offline" }));
    expect(local).toMatchObject({ label: "arch", detail: `${MACHINE_LABELS.thisComputer} · 127.0.0.1:7700`, tone: "danger", removable: false });
    expect(local.hostLabel).toBe(MACHINE_LABELS.noHost);
  });

  it("finds the active machine", () => {
    expect(activeMachine([machine({ id: "a" }), machine({ id: "b", active: true })])?.id).toBe("b");
    expect(activeMachine([])).toBeNull();
  });

  it("reads an address with a token", () => {
    expect(readAddMachineForm(form({ address: " https://office.ts.net ", token: " t " }))).toEqual({
      ok: true,
      input: { apiUrl: "https://office.ts.net", token: "t", name: null, pairingUrl: null },
      options: { hostLink: null, activate: true },
    });
    expect(readAddMachineForm(form({ address: "https://office.ts.net" }))).toEqual({ ok: false, errors: { token: MACHINE_LABELS.addDialog.tokenRequired } });
    expect(readAddMachineForm(form({ address: "office.ts.net", token: "t" }))).toEqual({ ok: false, errors: { address: MACHINE_LABELS.addDialog.invalidAddress } });
    expect(readAddMachineForm(form({}))).toEqual({ ok: false, errors: { address: MACHINE_LABELS.addDialog.addressRequired } });
  });

  it("reads a pairing link, keeping a typed name over the link name", () => {
    const named = readAddMachineForm(form({ address: PAIR_LINK, name: "home" }));
    expect(named.ok && named.input).toMatchObject({ apiUrl: "https://sb.ts.net", name: "home" });
    const plain = readAddMachineForm(form({ address: PAIR_LINK }));
    expect(plain.ok && plain.input.name).toBe("rig");
    expect(readAddMachineForm(form({ address: "tesseract://pair?url=nope" }))).toEqual({ ok: false, errors: { address: MACHINE_LABELS.addDialog.invalidLink } });
    expect(readAddMachineForm(form({ address: HOST_LINK }))).toEqual({ ok: false, errors: { address: MACHINE_LABELS.addDialog.hostLinkInAddress } });
  });

  it("validates the optional host link and the activate flag", () => {
    const linked = readAddMachineForm(form({ address: PAIR_LINK, hostLink: ` ${HOST_LINK} `, activate: false }));
    expect(linked.ok && linked.options).toEqual({ hostLink: HOST_LINK, activate: false });
    expect(readAddMachineForm(form({ address: PAIR_LINK, hostLink: PAIR_LINK }))).toEqual({
      ok: false,
      errors: { hostLink: MACHINE_LABELS.addDialog.invalidHostLink },
    });
  });
});
