import type { AndroidLinkInfo, HostAndroidStatus, HostIosStatus, IosLinkInfo } from "@tesseract/protocol";
import type { DefineContract } from "../ipc-types";
import type { HttpProxyRequest, HttpProxyResponse } from "./http";

export type HostShellStatus = "stopped" | "starting" | "running" | "stopping" | "external" | "failed";

export interface HostPairing {
  link: string;
  url: string;
  name: string;
  pinSet: boolean;
}

export interface HostShellState {
  status: HostShellStatus;
  pairing: HostPairing | null;
  error: string | null;
  log: string[];
  autostart: boolean;
  sessionExpiresAt: number | null;
}

export interface EmulatorViewerRequest {
  serial: string;
  title: string;
}

export const HOST_TERMINAL_KINDS = ["shell", "claude"] as const;
export type HostTerminalKind = (typeof HOST_TERMINAL_KINDS)[number];

export interface HostTerminalRequest {
  projectId: string;
  title: string;
  kind?: HostTerminalKind;
}

/** A sandbox project's host copy in the host workspace controller (`tesseract-controller host workspace serve`). */
export interface HostWorkspaceTarget {
  projectId: string;
  apiUrl: string;
  token: string;
  name: string;
}

export const EMULATOR_STOP_SIGNALS = ["SIGTERM", "SIGKILL"] as const;
export type EmulatorStopSignal = (typeof EMULATOR_STOP_SIGNALS)[number];

export type HostShellContract = DefineContract<{
  methods: {
    state(): HostShellState;
    start(): HostShellState;
    stop(): HostShellState;
    refresh(): HostShellState;
    setPin(pin: string): HostShellState;
    rotateToken(): HostShellState;
    setAutostart(enabled: boolean): HostShellState;
    unlock(pin: string): HostShellState;
    lock(): HostShellState;
    androidStatus(): HostAndroidStatus;
    startEmulator(avd: string): HostAndroidStatus;
    stopEmulator(signal?: EmulatorStopSignal): HostAndroidStatus;
    linkSandbox(sandboxUrl: string, token: string): AndroidLinkInfo;
    iosStatus(): HostIosStatus;
    bootSimulator(udid: string): HostIosStatus;
    shutdownSimulator(signal?: EmulatorStopSignal): HostIosStatus;
    linkIosSandbox(sandboxUrl: string, token: string): IosLinkInfo;
    openEmulatorViewer(request: EmulatorViewerRequest): void;
    openTerminal(request: HostTerminalRequest): void;
    openWorkspace(projectId: string): HostWorkspaceTarget;
    request(id: string, request: HttpProxyRequest): HttpProxyResponse;
    abort(id: string): void;
  };
  events: {
    state: HostShellState;
  };
}>;
