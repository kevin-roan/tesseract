import type { DefineContract } from "../ipc-types";
import type { TransferProgress } from "./common";

export type UpdateState =
  | { kind: "idle"; checkedAt: string | null }
  | { kind: "unsupported"; reason: string }
  | { kind: "checking" }
  | { kind: "available"; version: string; notes: string | null }
  | { kind: "downloading"; version: string; progress: TransferProgress }
  | { kind: "ready"; version: string }
  | { kind: "up-to-date"; checkedAt: string }
  | { kind: "error"; message: string };

export type UpdatesContract = DefineContract<{
  methods: {
    state(): UpdateState;
    check(): UpdateState;
    download(): UpdateState;
    install(): void;
  };
  events: {
    state: UpdateState;
  };
}>;
