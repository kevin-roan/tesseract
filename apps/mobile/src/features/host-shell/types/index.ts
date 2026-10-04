export type PairedHost = {
  name: string;
  baseUrl: string;
  addedAt: string;
};

export type HostSessionState = {
  session: string;
  expiresAt: string;
};

export type HostIssue = "unauthorized" | "incompatible";

export type HostScreenMode = "loading" | "setup" | "locked" | "unlocked";

export type PinState = {
  digits: string;
  error: boolean;
};

export type PinAction = { type: "digit"; digit: string } | { type: "delete" } | { type: "clear" } | { type: "reject" };

export type LockLine = { tone: "neutral" | "warning" | "danger"; message: string };
