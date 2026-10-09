import type { IconName } from "../../theme/icons";

const GIB = 1024 ** 3;

export const DISK_RECOMMENDED_BYTES = 40 * GIB;
export const MEMORY_RECOMMENDED_BYTES = 12 * GIB;
export const BYTES_PER_GB = GIB;
export const BYTES_PER_TB = 1024 * GIB;

export const NO_EMULATOR_HOSTS: readonly string[] = ["linux/arm64", "win32/arm64"];

export const WHAT_HAPPENS_ROWS: readonly { id: "docker" | "claude" | "sandbox" | "android" | "phone"; icon: IconName }[] = [
  { id: "docker", icon: "docker" },
  { id: "claude", icon: "agents" },
  { id: "sandbox", icon: "sandbox" },
  { id: "android", icon: "smartphone" },
  { id: "phone", icon: "pair" },
];

export const REMOTE_DIALOG_WIDTH = 480;
export const REMOTE_FIELDS = { address: "", token: "" } as const;
