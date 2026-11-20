export function accountServiceUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_ACCOUNT_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}
