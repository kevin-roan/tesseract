export type ContainerAction = "start" | "stop" | "restart";

export type CreateBlocker = "sysbox" | "vm" | "image";

export type ContainersTaskPhase = "building" | "setting-up-vm";

export type ContainerShellStatus =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "open" }
  | { kind: "exited"; code: number | null }
  | { kind: "error"; message: string };
