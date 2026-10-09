export const DISCOVERY_MESSAGES = {
  noDocker: "docker is not installed on this machine",
  noPairingLink: "tesseract-controller pair --json printed no pairing link",
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

export const VERIFY_MESSAGES = {
  unreachable: (url: string) => `${url} did not answer. Check the address and that this computer is on the same tailnet.`,
  notTesseract: (url: string) => `${url} answered, but it is not a Tesseract sandbox.`,
  incompatible: "That Tesseract speaks a different protocol version; update the app or the sandbox.",
  unauthorized: "The sandbox refused the token. Copy a fresh pairing link with tesseract server pair.",
  failed: (status: number) => `The sandbox answered with HTTP ${status}.`,
} as const;
