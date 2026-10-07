export const DISCOVERY_MESSAGES = {
  noDocker: "docker is not installed on this machine",
  noPairingLink: "theone-controller pair --json printed no pairing link",
  invalidPairingLink: (error: string) => `controller printed an invalid pairing link: ${error}`,
  invalidInspect: "docker inspect printed invalid JSON",
  found: (name: string, url: string) => `Found ${name} at ${url}`,
  unreachable: (name: string) => `Found ${name}, but none of its addresses answered from this machine`,
  cancelled: "Discovery was cancelled",
} as const;

export const CONNECTION_MESSAGES = {
  invalidInput: "Enter a valid http(s) URL and a token",
  tokenUnreadable: "The saved token could not be decrypted on this computer",
} as const;
