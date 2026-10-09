export type ContainerAction = "start" | "stop" | "restart";

export type CreateBlocker = "sysbox" | "image";

export type ContainerShellStatus =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "open" }
  | { kind: "exited"; code: number | null }
  | { kind: "error"; message: string };
