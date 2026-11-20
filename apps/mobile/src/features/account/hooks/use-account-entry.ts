import { ACCOUNT_COPY } from "../utils/content";
import { accountLabel } from "../utils/view";
import { useAccountSession } from "./use-account-session";
import { useAccountNavigation } from "./use-account-navigation";

export function useAccountEntry() {
  const { account, signedIn } = useAccountSession();
  const nav = useAccountNavigation();

  const label = account ? accountLabel(account) : null;

  return {
    signedIn,
    cta: label ? ACCOUNT_COPY.signedInAs(label) : ACCOUNT_COPY.signInCta,
    title: ACCOUNT_COPY.entryTitle,
    subtitle: label ?? ACCOUNT_COPY.entrySignedOut,
    open: signedIn ? nav.account : nav.signIn,
  };
}
