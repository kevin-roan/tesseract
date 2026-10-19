import { HOST_PAIRING_ACTION, normalizeBaseUrl, parsePairingLink } from "@tesseract/protocol";
import type { ConnectionInput, MachineStatus, SavedMachine } from "../../../shared/contracts/connection";
import { inputFromPairingLink, type AddMachineOptions } from "../../app/connection";
import type { Tone } from "../../theme/colors";
import { MACHINE_STATUS_TONES, PAIR_LINK_SCHEME } from "./constants";
import { MACHINE_LABELS } from "./labels";

const L = MACHINE_LABELS.addDialog;

export function machineAddress(apiUrl: string): string {
  try {
    return new URL(apiUrl).host || apiUrl;
  } catch {
    return apiUrl;
  }
}

export function machineLabel(machine: Pick<SavedMachine, "apiUrl" | "name"> & { local?: boolean }): string {
  if (machine.name) return machine.name;
  if (machine.local) return MACHINE_LABELS.thisComputer;
  return machineAddress(machine.apiUrl);
}

export function machineDetail(machine: Pick<SavedMachine, "apiUrl" | "name" | "local">): string {
  const address = machineAddress(machine.apiUrl);
  return machine.local && machine.name ? `${MACHINE_LABELS.thisComputer} · ${address}` : address;
}

export interface MachineRow {
  id: string;
  apiUrl: string;
  label: string;
  detail: string;
  active: boolean;
  local: boolean;
  status: MachineStatus;
  statusLabel: string;
  tone: Tone;
  host: SavedMachine["host"];
  hostLabel: string;
  removable: boolean;
}

export function machineRow(machine: SavedMachine): MachineRow {
  const status: MachineStatus = machine.status ?? "unknown";
  const host = machine.host ?? null;
  return {
    id: machine.id,
    apiUrl: machine.apiUrl,
    label: machineLabel(machine),
    detail: machineDetail(machine),
    active: machine.active,
    local: machine.local,
    status,
    statusLabel: MACHINE_LABELS.status[status],
    tone: MACHINE_STATUS_TONES[status],
    host,
    hostLabel: host ? MACHINE_LABELS.hostLinked(host.name ?? machineAddress(host.url)) : MACHINE_LABELS.noHost,
    removable: !machine.local,
  };
}

export function activeMachine<T extends Pick<SavedMachine, "active">>(machines: readonly T[]): T | null {
  return machines.find((machine) => machine.active) ?? null;
}

export function isPairingLink(address: string): boolean {
  return address.trim().toLowerCase().startsWith(PAIR_LINK_SCHEME);
}

export function isHostLink(link: string): boolean {
  return parsePairingLink(link.trim(), HOST_PAIRING_ACTION).ok;
}

export interface AddMachineForm {
  address: string;
  token: string;
  hostLink: string;
  name: string;
  activate: boolean;
}

export const EMPTY_ADD_MACHINE_FORM: AddMachineForm = { address: "", token: "", hostLink: "", name: "", activate: true };

export interface AddMachineErrors {
  address?: string;
  token?: string;
  hostLink?: string;
}

export type AddMachineRequest =
  | { ok: true; input: ConnectionInput; options: AddMachineOptions }
  | { ok: false; errors: AddMachineErrors };

function readSandbox(form: AddMachineForm): { input: ConnectionInput } | { errors: AddMachineErrors } {
  const address = form.address.trim();
  const name = form.name.trim() || null;
  if (!address) return { errors: { address: L.addressRequired } };
  if (isPairingLink(address)) {
    const parsed = inputFromPairingLink(address);
    if (!parsed.ok) return { errors: { address: isHostLink(address) ? L.hostLinkInAddress : L.invalidLink } };
    return { input: { ...parsed.value, name: name ?? parsed.value.name ?? null } };
  }
  const apiUrl = /^https?:\/\//i.test(address) ? normalizeBaseUrl(address) : null;
  const token = form.token.trim();
  const errors: AddMachineErrors = {};
  if (!apiUrl) errors.address = L.invalidAddress;
  if (!token) errors.token = L.tokenRequired;
  if (!apiUrl || !token) return { errors };
  return { input: { apiUrl, token, name, pairingUrl: null } };
}

export function readAddMachineForm(form: AddMachineForm): AddMachineRequest {
  const sandbox = readSandbox(form);
  const hostLink = form.hostLink.trim() || null;
  const hostError = hostLink && !isHostLink(hostLink) ? L.invalidHostLink : undefined;
  if ("errors" in sandbox) return { ok: false, errors: { ...sandbox.errors, ...(hostError ? { hostLink: hostError } : {}) } };
  if (hostError) return { ok: false, errors: { hostLink: hostError } };
  return { ok: true, input: sandbox.input, options: { hostLink, activate: form.activate } };
}
