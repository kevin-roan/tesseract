import type { ReactNode } from "react";
import { currentPlatform } from "../../app/runtime";

export type TitlebarControls = { kind: "native" } | { kind: "custom"; node: ReactNode } | null;

export function useTitlebarControls(controls: boolean | ReactNode): TitlebarControls {
  if (controls === true) return currentPlatform() === "darwin" ? null : { kind: "native" };
  if (controls === false || controls === null || controls === undefined) return null;
  return { kind: "custom", node: controls };
}
