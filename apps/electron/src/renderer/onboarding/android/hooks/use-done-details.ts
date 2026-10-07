import { useMemo } from "react";
import { runtime } from "../../../app/runtime";
import type { DoneGroupProps } from "../components/DoneGroup";
import { ANDROID_LABELS } from "../labels";
import { apiOfTarget, versionName } from "../model";
import type { AndroidStepModel } from "./use-android-step";

export function useDoneDetails(step: AndroidStepModel): DoneGroupProps | null {
  const { phase, details, support, sources, host } = step;
  return useMemo(() => {
    if (phase.kind !== "done") return null;
    const info = details.avds.find((avd) => avd.name === phase.avd) ?? null;
    const api = apiOfTarget(info?.target ?? null);
    const abi = info?.abi ?? (support?.supported ? support.abi : "");
    const platform = host?.platform ?? runtime.platform;
    const linkable = support?.supported ? support.canLinkSandbox : platform !== "win32";
    return {
      sdkRoot: phase.sdkRoot,
      avd: phase.avd,
      avdPath: info?.path ?? null,
      version: api === null ? "" : (versionName(api) ?? String(api)),
      abi,
      emulatorRevision: sources.catalog?.emulator.revision ?? null,
      warnings: phase.warnings,
      isolationOs: linkable ? null : (ANDROID_LABELS.done.osNames[platform] ?? platform),
    };
  }, [details.avds, host, phase, sources.catalog, support]);
}
