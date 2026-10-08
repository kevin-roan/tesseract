import { ONBOARDING_LABELS } from "../labels";

export const WELCOME_LABELS = {
  title: ONBOARDING_LABELS.titles.welcome,
  description:
    "Tesseract runs Claude Code and your builds in a sandbox on this computer and lets you follow them from your phone. This setup installs what it needs and takes about an hour, mostly for the first image build.",
  getStarted: ONBOARDING_LABELS.buttons.getStarted,
  whatHappens: "What happens",
  requirements: "Requirements",
  rows: {
    docker: { title: "Docker", subtitle: "Checks Docker, or helps you install and start it" },
    claude: { title: "Claude Code", subtitle: "Uses the Claude Code login of this computer" },
    sandbox: { title: "Sandbox", subtitle: "Builds the sandbox image with the tools you pick" },
    android: {
      title: "Android emulator",
      subtitle: "Optional: downloads an emulator and a system image, like Android Studio",
    },
    phone: { title: "Phone", subtitle: "Optional: pairs the Tesseract app" },
  },
  checks: {
    disk: "Disk space",
    memory: "Memory",
    processor: "Processor",
    checking: "Checking…",
    unknown: "Couldn't read this computer's details",
    diskFree: (free: string, path: string) => `${free} free in ${path}`,
    diskUnknown: (path: string) => `Free space in ${path} is unknown`,
    diskLow: "About 40 GB is recommended (image, build cache, Android system image)",
    memoryValue: (gb: string) => `${gb} GB`,
    memoryLow: "The sandbox uses up to 8 GB; 16 GB or more is comfortable",
    processorValue: (cpus: number, arch: string) => `${cpus} cores · ${arch}`,
    processorNoEmulator: "The Android emulator isn't available for this processor",
  },
} as const;
