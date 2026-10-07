import type { ComponentType } from "react";
import { EMULATOR_EXPORT, TAB_COMPONENT_EXPORTS } from "../../../features/projects/constants";
import type { EmulatorButtonSlotProps } from "../../../features/projects/emulator";
import type { ProjectTabId } from "../../../features/projects/types";

type TabModule = Record<string, unknown>;

const tabModules = import.meta.glob<TabModule>("../tabs/*/index.ts", { eager: true });

const exportsOf = (folder: string): TabModule | null => tabModules[`../tabs/${folder}/index.ts`] ?? null;

export type TabComponent = ComponentType<Record<string, unknown>>;

export function findTabComponent(id: ProjectTabId): TabComponent | null {
  const { folder, name } = TAB_COMPONENT_EXPORTS[id];
  const component = exportsOf(folder)?.[name];
  return typeof component === "function" ? (component as TabComponent) : null;
}

const noSyncCount = (): number | null => null;
const noSyncRefresh = () => (): void => undefined;
const syncModule = exportsOf(TAB_COMPONENT_EXPORTS.sync.folder);

export const useSyncCount = (syncModule?.useSyncChangeCount as ((projectId: string | null) => number) | undefined) ?? noSyncCount;
export const useSyncRefresh = (syncModule?.useRefreshSyncView as (() => (projectId: string) => unknown) | undefined) ?? noSyncRefresh;

const emulatorModule = exportsOf(EMULATOR_EXPORT.folder);
const emulatorButton = emulatorModule?.[EMULATOR_EXPORT.name];

export const EmulatorButtonSlot: ComponentType<EmulatorButtonSlotProps> | null =
  typeof emulatorButton === "function" ? (emulatorButton as ComponentType<EmulatorButtonSlotProps>) : null;
