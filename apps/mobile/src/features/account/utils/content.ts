import type { AccountDeviceKind, AccountProvider, TailnetState } from "@tesseract/protocol";

import type { Tone } from "@/lib/tone";

export const ACCOUNT_COPY = {
  entryTitle: "Tesseract account",
  entrySignedOut: "Sign in to reach your sandbox without Tailscale",
  signInCta: "Sign in to Tesseract",
  signedInAs: (label: string) => `Signed in as ${label}`,
  screenTitle: "Tesseract account",
  screenSubtitle: "Your account and the Tesseract Network",
  signedOutTitle: "Not signed in",
  signedOutMessage:
    "Sign in to join the Tesseract Network. This phone then reaches your sandbox with no VPN app installed.",
  accountTitle: "Account",
  emailLabel: "Email",
  nameLabel: "Name",
  providerLabel: "Sign-in method",
  memberSinceLabel: "Member since",
  networkTitle: "Tesseract Network",
  statusLabel: "Status",
  deviceLabel: "This device",
  addressLabel: "Address",
  peersLabel: "Devices online",
  reconnect: "Reconnect",
  devicesTitle: "Devices",
  refresh: "Refresh",
  devicesEmpty: "No devices on your Tesseract Network yet.",
  removeDevice: "Remove",
  sessionTitle: "Session",
  signOut: "Sign out",
  deleteAccount: "Delete account",
  deleteFootnote:
    "Deleting your account removes it, its sessions and every device on your Tesseract Network. This can't be undone.",
} as const;

export const AUTH_COPY = {
  signInTitle: "Sign in",
  signInSubtitle: "Connect this phone to your sandbox, no VPN app needed",
  signUpTitle: "Create account",
  signUpSubtitle: "One account for your phone, desktop and sandbox",
  submitSignIn: "Sign in",
  submitSignUp: "Create account",
  toSignUp: "New to Tesseract? Create an account",
  toSignIn: "Already have an account? Sign in",
  orDivider: "or",
  footnote: "Already use Tailscale? You can pair without an account.",
  pairWithout: "Pair without an account",
} as const;

export const AUTH_SCREEN_COPY = {
  signIn: {
    title: AUTH_COPY.signInTitle,
    subtitle: AUTH_COPY.signInSubtitle,
    submit: AUTH_COPY.submitSignIn,
    switchLabel: AUTH_COPY.toSignUp,
  },
  signUp: {
    title: AUTH_COPY.signUpTitle,
    subtitle: AUTH_COPY.signUpSubtitle,
    submit: AUTH_COPY.submitSignUp,
    switchLabel: AUTH_COPY.toSignIn,
  },
} as const;

export type AccountFieldContent = { label: string; placeholder: string; hint?: string };

export const ACCOUNT_FIELDS = {
  email: { label: "Email", placeholder: "you@example.com" },
  password: { label: "Password", placeholder: "Your password" },
  newPassword: { label: "Password", placeholder: "At least 10 characters", hint: "At least 10 characters." },
  displayName: { label: "Name", placeholder: "Optional" },
} as const satisfies Record<string, AccountFieldContent>;

export const ACCOUNT_ERRORS = {
  email: "Enter a valid email address.",
  password: "Use between 10 and 256 characters.",
  passwordRequired: "Enter your password.",
  displayName: "Use up to 128 characters.",
  invalidCredentials: "That email and password don't match an account.",
  emailTaken: "An account with this email already exists. Sign in instead.",
  unauthorized: "Your session has expired. Sign in again.",
  notConfigured: "The account service isn't configured in this build (EXPO_PUBLIC_ACCOUNT_URL).",
  network: "Can't reach the Tesseract account service. Check your connection.",
  appleToken: "Sign in with Apple didn't return an identity token.",
  unknown: "Something went wrong. Try again.",
} as const;

export const CONFIRM_COPY = {
  signOut: {
    title: "Sign out?",
    message: "This phone leaves the Tesseract Network until you sign in again.",
    confirmLabel: "Sign out",
    destructive: true,
  },
  deleteAccount: {
    title: "Delete your account?",
    message:
      "Your account, its sessions and every device on your Tesseract Network are removed for good. Paired sandboxes reached over the Tesseract Network stop working.",
    confirmLabel: "Delete account",
    destructive: true,
  },
  removeDevice: (hostname: string) => ({
    title: `Remove ${hostname}?`,
    message: "It leaves your Tesseract Network and needs a new sign-in to join again.",
    confirmLabel: "Remove",
    destructive: true,
  }),
} as const;

export const PROVIDER_LABELS: Record<AccountProvider, string> = {
  password: "Email and password",
  apple: "Sign in with Apple",
};

export const DEVICE_KIND_LABELS: Record<AccountDeviceKind, string> = {
  mobile: "Phone",
  desktop: "Desktop",
  sandbox: "Sandbox",
  server: "Server",
};

export const TAILNET_STATE_VIEW: Record<TailnetState | "unavailable", { label: string; tone: Tone }> = {
  running: { label: "Connected", tone: "success" },
  starting: { label: "Connecting…", tone: "info" },
  needs_login: { label: "Needs sign-in", tone: "warning" },
  stopped: { label: "Disconnected", tone: "neutral" },
  error: { label: "Error", tone: "danger" },
  unavailable: { label: "Not available", tone: "neutral" },
};

export const DEVICE_COPY = {
  online: "Online",
  offline: "Offline",
  lastSeen: (when: string) => `Last seen ${when}`,
  separator: " · ",
} as const;

export const MOBILE_DEVICE_KIND: AccountDeviceKind = "mobile";
