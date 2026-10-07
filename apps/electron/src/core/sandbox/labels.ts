export const SANDBOX_LABELS = {
  validation: {
    project: "Use lowercase letters, digits, '-' and '_'",
    image: "Enter an image name such as theone/sandbox:latest",
    port: "Enter a port between 1 and 65535",
    portsClash: "The controller and VNC ports must be different",
    tailnetDomainRequired: "Enter your tailnet domain, such as tail1234.ts.net",
    tailnetDomain: "Use the tailnet DNS name, such as tail1234.ts.net",
    authKeyRequired: "An auth key is needed for the first start",
    hostname: "Use lowercase letters, digits and '-', at most 63 characters",
    bindAddrRequired: "Enter this computer's Tailscale IPv4 address",
    whisperModels: "Pick at least one model",
    cpus: (max: number) => `Choose between 1 and ${max} CPUs`,
    memory: (min: number, max: number) => `Choose between ${min} and ${max} GB`,
    timeZone: "The time zone is missing",
    version: "Use letters, digits, '.', '-' and '_'",
    claudeDir: "Choose an absolute folder path",
  },
  stack: {
    project: (value: string) =>
      `THEONE_COMPOSE_PROJECT=${value} is not a valid compose project name (lowercase letters, digits, '-' and '_')`,
    volumePrefix: (value: string) => `THEONE_VOLUME_PREFIX=${value} is not a valid volume name prefix`,
    port: (key: string, value: string) => `${key}=${value} is not a TCP port`,
    bindWildcard: (value: string) =>
      `THEONE_BIND_ADDR=${value} would publish the sandbox on every host interface; use the host's tailscale IPv4`,
    bindInvalid: (value: string) =>
      `THEONE_BIND_ADDR=${value} is not an IPv4 address of this host; use the host's tailscale IPv4`,
    noTailscaleIp: "could not determine the host tailscale IPv4: start tailscale on the host or set THEONE_BIND_ADDR",
    unknownMode: (value: string) => `unknown mode '${value}' (tailscale, host-tailscale or local)`,
    tailnetDomain: "TS_TAILNET_DOMAIN is required in tailscale mode (e.g. tail1234.ts.net, see infra/compose/.env.example)",
    authKey: "TS_AUTHKEY is required for the first start in tailscale mode (see infra/compose/.env.example)",
    socketDir: (value: string) => `THEONE_TAILSCALE_HOST_SOCKET_DIR=${value} must be an absolute path`,
    noSocket: (dir: string) =>
      `--tailscale-api: no tailscaled socket at ${dir}/tailscaled.sock (set THEONE_TAILSCALE_HOST_SOCKET_DIR)`,
    accountName: (name: string) =>
      `THEONE_HOST_CLAUDE_ACCOUNTS: invalid account name '${name}' (lowercase letters, digits, '-' and '_', at most 32)`,
    accountTwice: (name: string) => `THEONE_HOST_CLAUDE_ACCOUNTS: account '${name}' is listed twice`,
    accountPath: (name: string, path: string) => `THEONE_HOST_CLAUDE_ACCOUNTS: ${name}=${path} is not an absolute path`,
    accountSkipped: (name: string, path: string) =>
      `warning: Claude account '${name}' skipped: ${path} is not a directory`,
    notConfigured: "No sandbox is configured on this computer yet",
    invalidChoices: "Some sandbox settings are not valid",
  },
  build: {
    dockerNotReady: "Docker isn't ready; go back to the Docker step",
    diskLow: (free: number, path: string, need: number) =>
      `Only ${free} GB free on ${path}; the build needs about ${need} GB.`,
    diskVm: (need: number) =>
      `Docker Desktop keeps images in its own disk. Make sure it has about ${need} GB free (Docker Desktop › Settings › Resources).`,
    claudeDirMissing: (path: string) => `The Claude folder ${path} doesn't exist yet; finish the Claude step first.`,
    imageMissing: (image: string) => `The image ${image} isn't on this computer; build it first.`,
    noImageRef: "No image to download is configured",
    failed: (code: number | null) => `The build stopped with exit code ${code ?? "unknown"}`,
    pullFailed: (code: number | null) => `The download stopped with exit code ${code ?? "unknown"}`,
    stepFailed: (name: string, error: string) => `${name}: ${error}`,
    containerExited: (status: string) => `The sandbox container ${status}`,
    healthTimeout: "The controller didn't answer within 3 minutes",
    cancelled: "Build cancelled; finished steps are cached",
    alreadyRunning: "A build is already running",
    upToDate: "Image is up to date",
  },
  pairing: {
    noLink: "theone-controller pair --json printed no pairing link",
    invalidLink: (error: string) => `controller printed an invalid pairing link: ${error}`,
    unavailable: "The sandbox isn't running, so there is no pairing link yet",
    found: (name: string, url: string) => `Found ${name} at ${url}`,
  },
  docker: {
    missing: "docker is not installed on this machine",
  },
  autostart: {
    starting: (project: string) => `Starting the ${project} sandbox`,
    started: (project: string) => `The ${project} sandbox is running`,
    failedTitle: "The sandbox didn't start",
    dockerTitle: "Docker isn't running",
    dockerBody: "Monolith couldn't start the sandbox because Docker isn't reachable. Start Docker, then start the sandbox from Settings.",
  },
  adopt: {
    notFound: (project: string) => `There is no ${project} sandbox container on this computer any more`,
    noComposeFiles: (container: string) => `${container} is stopped and its compose files are gone, so Monolith can't start it`,
    starting: (container: string) => `Starting ${container}`,
    cancelled: "Stopped waiting for the sandbox",
  },
} as const;
