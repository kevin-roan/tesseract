import { useMemo } from "react";
import { router, type Href } from "expo-router";

import { ACCOUNT_ROUTE, AUTH_ROUTES } from "../utils/routes";
import type { AuthMode } from "../utils/form";

export function useAccountNavigation() {
  return useMemo(
    () => ({
      signIn: () => router.push(AUTH_ROUTES.signIn as Href),
      signUp: () => router.push(AUTH_ROUTES.signUp as Href),
      switchTo: (mode: AuthMode) => router.replace(AUTH_ROUTES[mode] as Href),
      account: () => router.push(ACCOUNT_ROUTE as Href),
      pair: () => router.push("/pair"),
      back: () => (router.canGoBack() ? router.back() : router.replace("/")),
    }),
    [],
  );
}
