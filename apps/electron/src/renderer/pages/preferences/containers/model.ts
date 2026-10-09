import type { CheckItem } from "../../../../shared/contracts/common";
import type { ContainersActionKey } from "../../../../shared/contracts/containers";
import type { CheckRowStatus } from "../../../onboarding/shell";
import { CONTAINERS_SETTINGS_LABELS as L } from "./labels";

export type InlineAction = keyof typeof L.checks.actions;

export interface CheckView {
  id: string;
  title: string;
  subtitle: string;
  status: CheckRowStatus;
  action: InlineAction | null;
}

function inlineAction(action: ContainersActionKey | undefined): InlineAction | null {
  return action === "install-sysbox" || action === "build-image" ? action : null;
}

export function checkViews(checks: readonly CheckItem<ContainersActionKey>[], buildStep: string | null, building: boolean): CheckView[] {
  return checks.map((check) => {
    const imageBuilding = building && check.action === "build-image";
    return {
      id: check.id,
      title: check.title,
      subtitle: imageBuilding ? buildStep || L.checks.building : check.detail,
      status: imageBuilding ? "running" : check.status,
      action: imageBuilding ? null : inlineAction(check.action),
    };
  });
}
