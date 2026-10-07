export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export interface TransferProgress {
  received: number;
  total: number | null;
  bytesPerSecond: number | null;
}

export interface CheckItem<Action extends string = string> {
  id: string;
  status: "ok" | "warning" | "error" | "pending";
  title: string;
  detail: string;
  action?: Action;
}

export type Unsubscribe = () => void;
