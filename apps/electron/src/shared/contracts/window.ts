import type { DefineContract } from "../ipc-types";
import type { OnboardingStepId } from "../routes";

export interface WindowState {
  maximized: boolean;
  fullscreen: boolean;
  focused: boolean;
  visible: boolean;
  zoom: number;
  systemDark: boolean;
}

export type ZoomDirection = -1 | 0 | 1;

export type WindowContract = DefineContract<{
  methods: {
    state(): WindowState;
    minimize(): void;
    toggleMaximize(): WindowState;
    close(): void;
    setFullscreen(on: boolean): WindowState;
    zoom(direction: ZoomDirection): number;
    openOnboarding(step?: OnboardingStepId): void;
    openMain(): void;
    setAccelGuard(active: boolean): void;
  };
  events: {
    state: WindowState;
  };
}>;
