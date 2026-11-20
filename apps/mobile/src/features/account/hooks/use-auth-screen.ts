import { useCallback, useState } from "react";

import { describeAccountError } from "../api/errors";
import { AUTH_SCREEN_COPY } from "../utils/content";
import { EMPTY_AUTH_DRAFT, OTHER_AUTH_MODE, validateSignIn, validateSignUp, type AuthDraft, type AuthErrors, type AuthField, type AuthMode, type Validation } from "../utils/form";
import { isCanceledSignIn, useAppleSignIn, useSignIn, useSignUp } from "./use-account-auth";
import { useAccountNavigation } from "./use-account-navigation";
import { useAppleAvailability } from "./use-apple-availability";

export function useAuthScreen(mode: AuthMode) {
  const nav = useAccountNavigation();
  const signIn = useSignIn();
  const signUp = useSignUp();
  const apple = useAppleSignIn();
  const appleAvailable = useAppleAvailability();
  const [draft, setDraft] = useState<AuthDraft>(EMPTY_AUTH_DRAFT);
  const [errors, setErrors] = useState<AuthErrors>({});

  const setField = useCallback((field: AuthField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const { mutateAsync: signInAsync, reset: resetSignIn } = signIn;
  const { mutateAsync: signUpAsync, reset: resetSignUp } = signUp;
  const { mutateAsync: appleAsync, reset: resetApple } = apple;
  const { back } = nav;

  const submit = useCallback(async () => {
    resetApple();
    const attempt = async <T,>(result: Validation<T>, send: (value: T) => Promise<unknown>): Promise<boolean> => {
      setErrors(result.ok ? {} : result.errors);
      if (!result.ok) return false;
      return send(result.value).then(
        () => true,
        () => false,
      );
    };
    const ok =
      mode === "signUp"
        ? await attempt(validateSignUp(draft), signUpAsync)
        : await attempt(validateSignIn(draft), signInAsync);
    if (ok) back();
  }, [mode, draft, signInAsync, signUpAsync, resetApple, back]);

  const signInWithApple = useCallback(async () => {
    resetSignIn();
    resetSignUp();
    if (await appleAsync().then(() => true, () => false)) back();
  }, [appleAsync, resetSignIn, resetSignUp, back]);

  const active = mode === "signIn" ? signIn : signUp;
  const failure = active.error ?? (apple.error && !isCanceledSignIn(apple.error) ? apple.error : null);
  const busy = active.isPending || apple.isPending;

  return {
    mode,
    copy: AUTH_SCREEN_COPY[mode],
    draft,
    errors,
    setField,
    submit,
    submitting: active.isPending,
    busy,
    message: failure ? describeAccountError(failure) : null,
    apple: appleAvailable ? { submit: signInWithApple, busy: apple.isPending } : null,
    switchMode: () => nav.switchTo(OTHER_AUTH_MODE[mode]),
    back,
    pair: nav.pair,
  };
}
