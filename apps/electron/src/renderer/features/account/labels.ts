export const ACCOUNT_FORM_LABELS = {
  server: { title: "Account server", placeholder: "https://account.example.com" },
  email: { title: "Email", placeholder: "you@example.com" },
  password: { title: "Password" },
  displayName: { title: "Name", placeholder: "Optional" },
  signIn: "Sign in",
  signUp: "Create account",
  signedIn: (who: string) => `Signed in as ${who}`,
  failed: (error: string) => `Couldn't sign in: ${error}`,
  signUpFailed: (error: string) => `Couldn't create the account: ${error}`,
  serverFailed: (error: string) => `Couldn't save the server: ${error}`,
} as const;
