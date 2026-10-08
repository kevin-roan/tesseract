import { ONBOARDING_LABELS } from "../labels";

export const DOCKER_LABELS = {
  title: ONBOARDING_LABELS.titles.docker,
  description:
    "The sandbox is a Docker container. Tesseract needs the Docker engine running, with Compose and BuildKit.",
  group: "Docker on this computer",
  checkAgain: "Check again",
  checking: "Checking…",
  starting: (seconds: number) => `Starting the engine… ${seconds}s`,
  buttons: {
    back: ONBOARDING_LABELS.buttons.back,
    continue: ONBOARDING_LABELS.buttons.continue,
    cancel: ONBOARDING_LABELS.buttons.cancel,
    install: "Install",
    quit: "Quit Tesseract",
  },
  actions: {
    install: "Install…",
    start: "Start",
    "fix-permission": "Fix…",
    "install-wsl": "Install WSL…",
    "update-wsl": "Update WSL",
    "compose-docs": "How to update",
    "buildx-docs": "How to install",
    "virtualization-docs": "Learn more",
  },
  placeholderRows: {
    cli: "Docker",
    daemon: "Engine",
    compose: "Docker Compose",
    buildx: "BuildKit",
  },
  install: {
    title: "Install Docker",
    options: {
      desktopRecommended: "Docker Desktop (recommended)",
      desktopUser: "Docker Desktop for my user only",
      engine: "Docker Engine (recommended)",
      engineSubtitle: (distro: string) => `Installs Docker's packages for ${distro} with your password`,
      desktopLinux: "Docker Desktop for Linux",
      manual: "I'll install it myself",
      opensDocs: "Opens Docker's instructions in your browser",
      thisDistro: "this Linux",
    },
    license: "I accept the Docker Subscription Service Agreement",
    readLicense: "Read the agreement",
    stages: {
      downloading: "Downloading Docker",
      verifying: "Verifying the download",
      installing: "Installing Docker",
    },
    received: (received: string, total: string | null) => (total ? `${received} of ${total}` : received),
    cancelled: "Installation cancelled",
  },
  permission: {
    message:
      "Your user isn't in the docker group, so Tesseract can't talk to the engine. Being in this group gives root-level control of this computer.",
    addMe: "Add me to the docker group",
    command: "sudo usermod -aG docker $USER",
  },
  relogin: {
    title: "Log out to finish",
    message:
      "Log out and back in (or restart) so the docker group applies, then open Tesseract again. Setup continues where you left off.",
  },
  reboot: {
    title: "Restart to finish",
    message: (what: string) => `Windows needs a restart to finish installing ${what}. Setup continues where you left off.`,
    wsl: "WSL 2",
    desktop: "Docker Desktop",
  },
} as const;
