export const SECTION_LABELS = {
  title: "Connection",
  sandboxGroup: "Sandbox controller",
  sandboxDescription:
    "The desktop app talks to the controller REST API from this machine. Discovery asks Docker for the running sandbox and picks the first address that answers.",
  apiUrl: "API URL",
  token: "Token",
  name: "Display name",
  rediscover: "Rediscover",
  save: "Save & connect",
  pairingGroup: "Phone pairing",
  pairingDescription: "The URL phones use. Leave empty to reuse the API URL.",
  pairingUrl: "Pairing URL",
  pair: "Pair a phone",
  pairSubtitle: "Show the QR code and tesseract:// link to scan with the Tesseract app",
  showQr: "Show QR…",
  statusGroup: "Connection status",
  status: "Status",
  source: "Source",
  forget: "Forget saved connection",
  forgetSubtitle: "Removes the saved URL and token from this computer",
  forgetButton: "Forget",
} as const;

export const CONNECTION_FORM_TOASTS = {
  invalid: "Enter a valid http(s) URL and a token",
  saved: "Connection saved",
  discoveryFailed: (error: string) => `Discovery failed: ${error}`,
} as const;
