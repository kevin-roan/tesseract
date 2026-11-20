import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import type { AccountSession, CreateAccount, PasswordSignIn } from "@tesseract/protocol";

import { accountApi, type AccountApi } from "../api/client";
import { accountKeys } from "../api/query-keys";
import { deleteAccount, signOut, startSession, type StartResult } from "../services/lifecycle";
import { ACCOUNT_ERRORS } from "../utils/content";
import { appleDisplayName } from "../utils/form";

const APPLE_CANCELED = "ERR_REQUEST_CANCELED";

export function isCanceledSignIn(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === APPLE_CANCELED;
}

function useSessionMutation<T>(request: (api: AccountApi, input: T) => Promise<AccountSession>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: T): Promise<StartResult> => startSession(await request(accountApi(), input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

export function useSignIn() {
  return useSessionMutation((api, body: PasswordSignIn) => api.signIn(body));
}

export function useSignUp() {
  return useSessionMutation((api, body: CreateAccount) => api.signUp(body));
}

export function useAppleSignIn() {
  return useSessionMutation(async (api, _input: void) => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error(ACCOUNT_ERRORS.appleToken);
    const displayName = appleDisplayName(credential.fullName);
    return api.signInWithApple({ identityToken: credential.identityToken, ...(displayName ? { displayName } : {}) });
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => signOut(),
    onSettled: () => queryClient.removeQueries({ queryKey: accountKeys.all }),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteAccount(),
    onSuccess: () => queryClient.removeQueries({ queryKey: accountKeys.all }),
  });
}
