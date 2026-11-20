export const ACCOUNT_LABELS = {
  noServer: "Set the Tesseract account server URL first",
  badServer: (url: string) => `"${url}" is not an http(s) URL`,
  signedOut: "Sign in to your Tesseract account first",
  unreachable: (url: string, detail: string) => `Couldn't reach the account service at ${url}: ${detail}`,
  invalidResponse: (path: string) => `The account service sent an unexpected answer for ${path}`,
  httpError: (status: number) => `The account service answered HTTP ${status}`,
  sessionExpired: "Your Tesseract session expired; sign in again",
  noCipher: "This computer can't encrypt the session (no keychain), so you stay signed in only until Tesseract quits",
} as const;
