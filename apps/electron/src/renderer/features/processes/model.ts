import type { HostAndroidStatus, HostIosStatus, RuntimeEntry } from "@tesseract/protocol";
import type { ConnectionStatus } from "../../app/connection";
import type { RecordStatus } from "../../components/RecordRow";
import type { IconName } from "../../theme/icons";
import { elapsedSeconds, formatBytes, formatDuration, joinMeta, nowSeconds } from "../agents/format";
import {
  CONNECTION_EMPTY_ICONS,
  CPU_DIGITS,
  GROUP_ICONS,
  HOST_DEVICE_ACTIVE_STATES,
  LIVE_STATES,
  PROCESS_GROUPS,
  STATE_TONES,
} from "./constants";
import { CONNECTION_EMPTY_LABELS, ERROR_PLACEHOLDER, PROCESSES_LABELS as L, type ConnectionEmptyLabel } from "./labels";
import { SIM_EMULATOR_STATES } from "../emulator/constants";
import type { HostDeviceSnapshot, ProcessGroupModel, ProcessRowModel } from "./types";

export type ProjectNames = ReadonlyMap<string, string>;

export function stateStatus(state: string): RecordStatus {
  const label = L.states[state] ?? state.charAt(0).toUpperCase() + state.slice(1);
  return { label, tone: STATE_TONES[state] ?? "neutral", live: LIVE_STATES.includes(state) };
}

export function formatCpu(percent: number | null): string | null {
  if (percent === null || !Number.isFinite(percent)) return null;
  const text = percent.toFixed(CPU_DIGITS);
  return L.cpu(text.endsWith(".0") ? text.slice(0, -2) : text);
}

export function formatMemory(bytes: number | null): string | null {
  return bytes === null || !Number.isFinite(bytes) || bytes <= 0 ? null : formatBytes(bytes);
}

export function formatUptime(startedAt: string | null, now: number = nowSeconds()): string | null {
  const seconds = elapsedSeconds(startedAt, null, now);
  return seconds === null ? null : L.uptime(formatDuration(seconds));
}

export function entryMeta(entry: RuntimeEntry, projects: ProjectNames, now: number = nowSeconds()): string {
  const project = entry.projectId ? (projects.get(entry.projectId) ?? entry.projectId) : null;
  return joinMeta(
    entry.pid === null ? null : L.pid(entry.pid),
    project,
    formatUptime(entry.startedAt, now),
    formatCpu(entry.cpuPercent),
    formatMemory(entry.memoryBytes),
  );
}

export function entrySubtitle(detail: string | null, supervised: boolean): string | null {
  return joinMeta(detail, supervised && L.supervised) || null;
}

export function entryRow(entry: RuntimeEntry, projects: ProjectNames, now: number = nowSeconds()): ProcessRowModel {
  const name = entry.name || entry.id;
  return {
    key: `${entry.kind}:${entry.id}`,
    target: { group: entry.kind, id: entry.id, name, supervised: entry.supervised },
    title: name,
    subtitle: entrySubtitle(entry.detail, entry.supervised),
    meta: entryMeta(entry, projects, now),
    status: stateStatus(entry.state),
    canStop: entry.canStop,
  };
}

export function hostDeviceSnapshots(android: HostAndroidStatus | null, ios: HostIosStatus | null): HostDeviceSnapshot[] {
  const devices: HostDeviceSnapshot[] = [];
  if (android) {
    const { emulator } = android;
    devices.push({ id: "android", state: emulator.state, name: emulator.avd ?? L.hostEmulator, detail: L.hostDeviceDetail(emulator.serial), startedAt: emulator.startedAt });
  }
  const sim = ios?.booted ?? ios?.devices.find((device) => device.state === "booting" || device.state === "shutting_down") ?? null;
  if (sim) {
    devices.push({ id: "ios", state: SIM_EMULATOR_STATES[sim.state], name: sim.name, detail: joinMeta(L.hostSimulator, sim.runtime), startedAt: null });
  }
  return devices.filter(isDeviceActive);
}

export function isDeviceActive(device: HostDeviceSnapshot): boolean {
  return HOST_DEVICE_ACTIVE_STATES.includes(device.state);
}

export function deviceRow(device: HostDeviceSnapshot, now: number = nowSeconds()): ProcessRowModel {
  return {
    key: `emulator:${device.id}`,
    target: { group: "emulator", id: device.id, name: device.name, supervised: false },
    title: device.name,
    subtitle: device.detail,
    meta: joinMeta(formatUptime(device.startedAt, now)),
    status: stateStatus(device.state),
    canStop: device.state !== "stopping",
  };
}

export function processGroups(
  entries: readonly RuntimeEntry[],
  devices: readonly HostDeviceSnapshot[],
  projects: ProjectNames,
  now: number = nowSeconds(),
): ProcessGroupModel[] {
  const rows = new Map<string, ProcessRowModel[]>();
  for (const entry of entries) {
    const list = rows.get(entry.kind) ?? [];
    list.push(entryRow(entry, projects, now));
    rows.set(entry.kind, list);
  }
  const active = devices.filter(isDeviceActive);
  if (active.length > 0) rows.set("emulator", active.map((device) => deviceRow(device, now)));
  return PROCESS_GROUPS.flatMap((id) => {
    const list = rows.get(id);
    return list && list.length > 0 ? [{ id, title: L.groups[id], icon: GROUP_ICONS[id], rows: list }] : [];
  });
}

export function runningCount(entries: readonly RuntimeEntry[] | null | undefined, devices: readonly HostDeviceSnapshot[]): number {
  return (entries?.length ?? 0) + devices.filter(isDeviceActive).length;
}

export function projectNames(projects: readonly { id: string; name: string }[] | null | undefined): ProjectNames {
  return new Map((projects ?? []).map((project) => [project.id, project.name || project.id]));
}

export function connectionEmpty(status: ConnectionStatus, error: string | null): (ConnectionEmptyLabel & { loading: boolean; icon: IconName }) | null {
  if (status === "online") return null;
  const entry = CONNECTION_EMPTY_LABELS[status];
  return {
    ...entry,
    message: entry.message === null ? null : entry.message.replace(ERROR_PLACEHOLDER, error ?? "").trim() || null,
    loading: status === "discovering" || status === "connecting",
    icon: CONNECTION_EMPTY_ICONS[status],
  };
}

export interface ConnectionNotice {
  title: string | undefined;
  message: string;
  icon: IconName;
  action: ConnectionEmptyLabel["action"];
}

export function connectionNotice(offline: ReturnType<typeof connectionEmpty>): ConnectionNotice | null {
  if (!offline) return null;
  return offline.message
    ? { title: offline.title, message: offline.message, icon: offline.icon, action: offline.action }
    : { title: undefined, message: offline.title, icon: offline.icon, action: offline.action };
}
