import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ActionButton } from "../../../components/ActionButton";
import { PreferenceRow, SettingsGroup } from "../../../components/PreferenceRows";
import { Reveal } from "../../../components/Reveal";
import { ChoiceRow } from "../../shell";
import { useAccountState } from "../../../features/account/hooks/use-account-state";
import { useSignIn } from "../../../features/account/hooks/use-sign-in";
import { ACCOUNT_FORM_LABELS } from "../../../features/account/labels";
import { accountName } from "../../../features/account/model";
import { SignInRows } from "../../../features/account/SignInRows";
import { REACHABILITY_ORDER, REACHABILITY_SECTION, SANDBOX_QUERY_KEYS } from "../constants";
import { useFocusSection } from "../hooks/use-focus-section";
import type { SandboxForm } from "../hooks/use-sandbox-form";
import { SANDBOX_STEP_LABELS } from "../labels";
import { hostTailscaleAvailable as canUseHostTailscale, reachabilitySubtitle } from "../model";
import { FieldRow } from "../parts/FieldRow";
import styles from "../SandboxStep.module.css";

const L = SANDBOX_STEP_LABELS.reachability;

export interface ReachabilitySectionProps {
  form: SandboxForm;
  busy: boolean;
  tailscaleIp: string;
  onOpenKeys(): void;
}

export function ReachabilitySection({ form, busy, tailscaleIp, onOpenKeys }: ReachabilitySectionProps) {
  const { choices, fieldIssues, update } = form;
  const ref = useFocusSection<HTMLDivElement>(REACHABILITY_SECTION);
  const hostTailscaleAvailable = canUseHostTailscale(choices, tailscaleIp);
  const account = useAccountState();
  const signIn = useSignIn(account);
  const signedIn = Boolean(account?.account);
  const queryClient = useQueryClient();
  // tesseract-net is only valid signed in: validate again when that changes.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: SANDBOX_QUERY_KEYS.validate });
  }, [queryClient, signedIn]);
  return (
    <div ref={ref} className={styles.anchor}>
      <SettingsGroup title={L.title} listRole="radiogroup">
        {REACHABILITY_ORDER.map((mode) => (
          <ChoiceRow
            key={mode}
            title={L.choices[mode].title}
            subtitle={reachabilitySubtitle(mode, choices, tailscaleIp)}
            checked={choices.mode === mode}
            disabled={busy || (mode === "host-tailscale" && !hostTailscaleAvailable)}
            onSelect={() =>
              update({
                mode,
                bindAddr: mode === "host-tailscale" ? choices.bindAddr || tailscaleIp : choices.bindAddr,
              })
            }
          />
        ))}
        <Reveal open={choices.mode === "tailscale"} className={styles.nested}>
          <FieldRow
            title={L.authKey.title}
            subtitle={L.authKey.subtitle}
            placeholder={L.authKey.placeholder}
            value={choices.tsAuthKey}
            error={fieldIssues.tsAuthKey}
            password
            disabled={busy}
            onChange={(tsAuthKey) => update({ tsAuthKey })}
          />
          <FieldRow
            title={L.tailnetDomain.title}
            placeholder={L.tailnetDomain.placeholder}
            value={choices.tailnetDomain}
            error={fieldIssues.tailnetDomain}
            disabled={busy}
            onChange={(tailnetDomain) => update({ tailnetDomain: tailnetDomain.trim().toLowerCase() })}
          />
          <FieldRow
            title={L.hostname.title}
            value={choices.hostname}
            error={fieldIssues.hostname}
            disabled={busy}
            onChange={(hostname) => update({ hostname: hostname.trim() })}
          />
          <div className={styles.linkRow}>
            <ActionButton label={L.authKeyHelp} variant="link" size="sm" icon="external" onClick={onOpenKeys} />
          </div>
        </Reveal>
        <Reveal open={choices.mode === "tesseract-net"} className={styles.nested}>
          {account?.account ? (
            <PreferenceRow
              title={L.account.title}
              subtitle={account.persisted ? ACCOUNT_FORM_LABELS.signedIn(accountName(account.account)) : L.account.notPersisted}
            />
          ) : (
            <>
              <PreferenceRow title={L.account.title} subtitle={fieldIssues.mode ?? L.account.signedOut} />
              <SignInRows form={signIn} disabled={busy} />
            </>
          )}
          <FieldRow
            title={L.hostname.title}
            value={choices.hostname}
            error={fieldIssues.hostname}
            disabled={busy}
            onChange={(hostname) => update({ hostname: hostname.trim() })}
          />
        </Reveal>
        <Reveal open={choices.mode === "host-tailscale"} className={styles.nested}>
          <FieldRow
            title={L.bindAddr.title}
            placeholder={tailscaleIp || L.bindAddr.placeholder}
            value={choices.bindAddr}
            error={fieldIssues.bindAddr}
            mono
            disabled={busy}
            onChange={(bindAddr) => update({ bindAddr: bindAddr.trim() })}
          />
        </Reveal>
      </SettingsGroup>
    </div>
  );
}
