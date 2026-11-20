import { ActionButton } from "../../components/ActionButton";
import { EntryRow, PreferenceRow } from "../../components/PreferenceRows";
import type { SignInForm } from "./hooks/use-sign-in";
import { ACCOUNT_FORM_LABELS as L } from "./labels";
import styles from "./SignInRows.module.css";

export interface SignInRowsProps {
  form: SignInForm;
  disabled?: boolean;
  /** Show the name field (sign-up in Settings › Account). */
  withName?: boolean;
}

/** Account server, email and password rows with Sign in / Create account; goes inside a SettingsGroup. */
export function SignInRows({ form, disabled = false, withName = false }: SignInRowsProps) {
  const off = disabled || form.busy;
  return (
    <>
      <EntryRow
        title={L.server.title}
        type="url"
        placeholder={L.server.placeholder}
        value={form.server}
        disabled={off}
        onChange={form.setServer}
        onBlur={() => void form.saveServer()}
      />
      <EntryRow title={L.email.title} type="email" autoComplete="username" placeholder={L.email.placeholder} value={form.email} disabled={off} onChange={form.setEmail} />
      <EntryRow
        title={L.password.title}
        password
        autoComplete="current-password"
        value={form.password}
        disabled={off}
        onChange={form.setPassword}
        onActivate={() => {
          if (form.canSubmit) void form.signIn();
        }}
      />
      {withName ? (
        <EntryRow title={L.displayName.title} placeholder={L.displayName.placeholder} value={form.displayName} disabled={off} onChange={form.setDisplayName} />
      ) : null}
      <PreferenceRow
        title={form.error ?? ""}
        className={form.error ? styles.error : undefined}
        suffix={
          <span className={styles.actions}>
            <ActionButton label={L.signUp} size="sm" disabled={off || !form.canSubmit} onClick={() => void form.signUp()} />
            <ActionButton label={L.signIn} size="sm" variant="primary" busy={form.busy} disabled={off || !form.canSubmit} onClick={() => void form.signIn()} />
          </span>
        }
      />
    </>
  );
}
