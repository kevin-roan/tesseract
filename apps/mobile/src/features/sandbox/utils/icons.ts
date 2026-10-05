import type { Framework } from "@theone/protocol";
import {
  AndroidLogoIcon,
  AppWindowIcon,
  AtomIcon,
  CircleDashedIcon,
  ClockIcon,
  PlayCircleIcon,
  WarningCircleIcon,
  CpuIcon,
  CubeIcon,
  DeviceMobileIcon,
  FileJsIcon,
  FilePyIcon,
  GlobeIcon,
  HammerIcon,
  HardDrivesIcon,
  LightningIcon,
  MemoryIcon,
  MonitorIcon,
  SparkleIcon,
  TerminalWindowIcon,
  type Icon,
} from "phosphor-react-native";

import type { HubAction, ProjectActivity } from "../types";

const FRAMEWORK_ICONS: Record<Framework, Icon> = {
  expo: AtomIcon,
  "react-native": AtomIcon,
  electron: AppWindowIcon,
  vite: LightningIcon,
  next: GlobeIcon,
  node: FileJsIcon,
  android: AndroidLogoIcon,
  python: FilePyIcon,
  flutter: DeviceMobileIcon,
  unknown: CubeIcon,
};

const PROJECT_ACTIVITY_ICONS: Record<ProjectActivity, Icon> = {
  building: HammerIcon,
  agent: SparkleIcon,
  running: PlayCircleIcon,
  failed: WarningCircleIcon,
  idle: CircleDashedIcon,
};

export const projectActivityIcon = (activity: ProjectActivity): Icon => PROJECT_ACTIVITY_ICONS[activity];

export const frameworkIcon = (framework: Framework): Icon => FRAMEWORK_ICONS[framework];

export const HUB_ACTIONS: readonly HubAction[] = [
  { id: "display", label: "Display", icon: MonitorIcon, tone: "yellow" },
  { id: "terminal", label: "Terminal", icon: TerminalWindowIcon },
  { id: "claude", label: "Claude", icon: SparkleIcon },
  {
    id: "build",
    label: "Build",
    icon: HammerIcon,
    hint: "Opens a project that has build targets.",
    unavailableHint: "Unavailable until a project has build targets.",
  },
];

export const ResourceIcons = {
  cpu: CpuIcon,
  memory: MemoryIcon,
  disk: HardDrivesIcon,
  display: MonitorIcon,
  uptime: ClockIcon,
} as const satisfies Record<string, Icon>;
