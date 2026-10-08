import type { SandboxComponent, WhisperModel } from "../../../shared/contracts/sandbox";
import type { BuildRowId } from "./model";

export const SANDBOX_STEP_LABELS = {
  description:
    "Choose how your phone reaches the sandbox and which tools go into the image. You can rebuild with other choices later.",
  existing: {
    title: "Found a sandbox",
    running: (container: string, image: string, size: string) => `${container} is running on this computer (${image}, ${size}).`,
    stopped: (container: string) => `${container} exists but is stopped.`,
    useIt: "Use it",
    startAndUse: "Start and use it",
  },
  reachability: {
    title: "Reachability",
    choices: {
      local: {
        title: "This computer only",
        subtitle: (port: number) =>
          `The controller listens on 127.0.0.1:${port}. Phones can't reach it; use this to try Tesseract or for development.`,
      },
      tailscale: {
        title: "Tailscale (sidecar)",
        subtitle: (hostname: string) =>
          `A Tailscale container joins your tailnet as ${hostname}; phones connect over HTTPS. Needs an auth key.`,
      },
      "host-tailscale": {
        title: "This computer's Tailscale",
        subtitle: (ip: string) => `The ports are published on this computer's Tailscale address (${ip}).`,
        unavailable: "Tailscale isn't running on this computer",
        unknownIp: "unknown",
      },
    },
    authKey: {
      title: "Auth key",
      subtitle: "Used once for the first login",
      placeholder: "tskey-auth-…",
    },
    tailnetDomain: { title: "Tailnet domain", placeholder: "tail1234.ts.net" },
    hostname: { title: "Hostname" },
    bindAddr: { title: "Bind address", placeholder: "100.64.0.1" },
    authKeyHelp: "How to create an auth key",
  },
  source: {
    title: "Image",
    choices: {
      build: {
        title: "Build a new image",
        subtitle:
          "Builds from the files bundled with Tesseract. The first build takes 20 to 60 minutes; later builds reuse the cache.",
      },
      pull: {
        title: "Download a prebuilt image",
        subtitle: "Downloads a ready image with every tool included instead of building it here.",
        unavailable: "No prebuilt image is published yet.",
      },
      existing: {
        title: "Use the existing image",
        subtitle: (image: string, size: string, built: string) => `${image} · ${size} · built ${built}`,
      },
    },
  },
  tools: {
    title: "Tools in the image",
    total: (gb: string) => `About ${gb} GB`,
    base: {
      title: "Base desktop",
      subtitle: "Debian, Node 24, Bun, Chromium, Xvnc, ffmpeg, Wine, Claude Code",
      caption: "Always included",
    },
    components: {
      android: {
        title: "Android SDK",
        subtitle: () => "JDK 17, platform-tools, android-36, build-tools 36.0.0 for Android builds",
      },
      flutter: {
        title: "Flutter",
        subtitle: (version: string) => `Flutter ${version} with web and Linux artifacts`,
      },
      mono: {
        title: "Mono",
        subtitle: () => "Squirrel.Windows installers for Electron apps",
      },
      whisper: {
        title: "Whisper",
        subtitle: () => "Local speech-to-text for voice notes",
      },
    } satisfies Record<SandboxComponent, { title: string; subtitle(version: string): string }>,
    sizeCaption: (gb: string) => `+${gb} GB`,
    models: "Models",
    modelNames: {
      base: "base",
      small: "small",
      medium: "medium",
      "large-v3-turbo": "large-v3-turbo",
    } satisfies Record<WhisperModel, string>,
    baseNotice: "Chromium and Wine are part of the base image and can't be turned off.",
    prebuiltNotice: "A prebuilt image always includes every tool.",
  },
  disk: {
    title: "Disk space",
    ok: (need: number, free: string) => `Needs about ${need} GB; ${free} GB free`,
    low: (free: string, need: number) => `Only ${free} GB free; the build needs about ${need} GB.`,
    vm: (need: number) =>
      `Docker Desktop keeps images in its own disk. Make sure it has about ${need} GB free (Docker Desktop › Settings › Resources).`,
    unknown: (need: number) => `Needs about ${need} GB of free space for Docker.`,
    okBadge: "Enough",
    lowBadge: "Low",
    checkBadge: "Check",
  },
  resources: {
    title: "Resources",
    cpus: "CPUs",
    memory: "Memory",
    timeZone: "Time zone",
    cpuUnit: "cores",
    memoryUnit: "GB",
    decrease: "Decrease",
    increase: "Increase",
  },
  advanced: {
    title: "Advanced",
    project: "Compose project",
    image: "Image",
    controllerPort: "Controller port",
    vncPort: "VNC port",
    claudeCodeVersion: "Claude Code version",
    hostClaudeDir: "Shared Claude folder",
    flutterVersion: "Flutter version",
    dind: "Docker-in-Docker",
    dindSubtitle: "Adds a privileged docker:dind container; read docs/architecture/security-model.md first",
  },
  build: {
    title: "Build",
    phase: {
      idle: "Ready to build",
      preflight: "Checking disk space…",
      building: "Building the image…",
      upToDate: "Image is up to date",
      pulling: "Downloading the image…",
      starting: "Starting the sandbox…",
      waiting: "Waiting for the controller…",
      pairing: "Reading the pairing link…",
      done: "Sandbox ready",
      failed: "Setup failed",
      cancelled: "Build cancelled",
    },
    rows: {
      image: "Build image",
      up: "Start containers",
      health: "Controller healthy",
      pair: "Pairing link",
    } satisfies Record<BuildRowId, string>,
    downloadRow: "Download image",
    existingRow: "Use existing image",
    skipped: "Skipped",
    steps: (done: number, total: number) => `${done} of ${total} steps`,
    cached: (count: number) => `${count} cached`,
    bytes: (current: string, total: string) => `${current} of ${total}`,
    composeUp: "docker compose up --detach",
    waitingFor: (elapsed: string) => `Polling /v1/health · ${elapsed}`,
    readyAt: (url: string) => `Controller at ${url}`,
    cancelledToast: "Build cancelled; finished steps are cached",
    failedToast: "The sandbox setup failed",
  },
  log: {
    show: "Show details",
    hide: "Hide details",
    copy: "Copy log",
    copied: "Copied",
    title: "Build log",
    empty: "No output yet",
  },
  buttons: {
    build: "Build",
    download: "Download",
    useImage: "Continue",
    cancel: "Cancel",
    retry: "Retry",
    startAgain: "Start again",
    continue: "Continue",
    back: "Back",
  },
  duration: {
    seconds: (s: number) => `${s}s`,
    minutes: (m: number, s: number) => `${m}m ${s}s`,
    hours: (h: number, m: number) => `${h}h ${m}m`,
  },
  relative: {
    now: "just now",
    minutes: (n: number) => `${n} min ago`,
    hours: (n: number) => `${n} h ago`,
    days: (n: number) => (n === 1 ? "yesterday" : `${n} days ago`),
  },
} as const;
