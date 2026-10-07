import type { DefineContract } from "../ipc-types";

export interface TrayState {
  attached: boolean;
  tooltip: string;
}

export type TrayContract = DefineContract<{
  methods: {
    state(): TrayState;
    setStatus(label: string): TrayState;
  };
  events: {
    state: TrayState;
  };
}>;
