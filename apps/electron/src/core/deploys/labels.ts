export const DEPLOY_MESSAGES = {
  noContainer: (name: string) => `There is no server container named "${name}" on this host.`,
  sizeMismatch: (expected: number, actual: number) => `The bundle has ${actual} bytes, expected ${expected}.`,
  shaMismatch: "The bundle checksum doesn't match the deploy.",
  tooLarge: "The bundle is larger than the deploy limit.",
  notWaiting: "That deploy isn't waiting for approval.",
  notConnected: "Not connected to a sandbox.",
  creating: (name: string) => `Creating container ${name}…\n`,
  created: (name: string) => `Created container ${name}`,
} as const;

export const DEPLOY_TITLES = {
  approval: (app: string, container: string) => `Deploy ${app} to ${container}?`,
  create: (container: string, app: string) => `Create container ${container} for ${app}?`,
  createBody: (sandbox: string, hostname: string | null) =>
    `${sandbox} wants a new server container${hostname ? ` serving ${hostname}` : ""}. Open Containers to approve or reject.`,
  approvalBody: (sandbox: string, hostname: string | null) => `${sandbox} wants to deploy${hostname ? ` to ${hostname}` : ""}. Open Containers to approve or reject.`,
  deployed: (app: string, container: string) => `Deployed ${app} to ${container}`,
  deployedBody: (urls: readonly string[]) => urls.join("\n") || "The app is running.",
  failed: (app: string, container: string) => `Deploy of ${app} to ${container} failed`,
} as const;
