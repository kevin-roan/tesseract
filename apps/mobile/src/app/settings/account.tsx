import { ArrowsClockwiseIcon, SignOutIcon, TrashIcon, UserCircleIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import EmptyState from "@/components/empty-state";
import KeyValueList from "@/components/key-value-list";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import AccountDevices from "@/features/account/components/account-devices";
import { useAccountScreen } from "@/features/account/hooks/use-account-screen";
import { ACCOUNT_COPY, AUTH_COPY } from "@/features/account/utils/content";

export default function AccountScreen() {
  const screen = useAccountScreen();
  const { account, network, devices } = screen;

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={account ? screen.refresh : undefined}
      header={
        <ScreenHeader
          title={ACCOUNT_COPY.screenTitle}
          subtitle={ACCOUNT_COPY.screenSubtitle}
          onBack={screen.nav.back}
        />
      }
    >
      {!account ? (
        screen.hydrated ? (
          <EmptyState
            icon={UserCircleIcon}
            title={ACCOUNT_COPY.signedOutTitle}
            message={ACCOUNT_COPY.signedOutMessage}
            actionLabel={AUTH_COPY.submitSignIn}
            onAction={screen.nav.signIn}
            secondaryLabel={AUTH_COPY.submitSignUp}
            onSecondary={screen.nav.signUp}
          />
        ) : null
      ) : (
        <>
          {screen.error ? <Notice tone="danger" message={screen.error} /> : null}

          <MotionItem index={0}>
            <Section title={ACCOUNT_COPY.accountTitle} testID="account-details">
              <KeyValueList items={screen.accountRows} testID="account-rows" />
            </Section>
          </MotionItem>

          <MotionItem index={1}>
            <Section title={ACCOUNT_COPY.networkTitle} testID="account-network">
              <KeyValueList items={network.rows} testID="account-network-rows" />
              {network.error ? <Notice tone="danger" message={network.error} /> : null}
              {network.canReconnect ? (
                <ActionButton
                  label={ACCOUNT_COPY.reconnect}
                  icon={ArrowsClockwiseIcon}
                  variant="secondary"
                  loading={network.reconnecting}
                  onPress={network.reconnect}
                  testID="account-reconnect"
                />
              ) : null}
            </Section>
          </MotionItem>

          <MotionItem index={2}>
            <Section
              title={ACCOUNT_COPY.devicesTitle}
              actionLabel={ACCOUNT_COPY.refresh}
              onPressAction={devices.retry}
              loading={devices.loading}
              isEmpty={devices.rows.length === 0}
              emptyLabel={devices.error ?? ACCOUNT_COPY.devicesEmpty}
              testID="account-devices"
            >
              {devices.error ? <Notice tone="danger" message={devices.error} /> : null}
              <AccountDevices
                rows={devices.rows}
                removing={devices.removing}
                removeLabel={ACCOUNT_COPY.removeDevice}
                onRemove={(row) => void devices.remove(row)}
                testID="account-device"
              />
            </Section>
          </MotionItem>

          <MotionItem index={3}>
            <Section title={ACCOUNT_COPY.sessionTitle} testID="account-session">
              <ActionButton
                label={ACCOUNT_COPY.signOut}
                icon={SignOutIcon}
                variant="secondary"
                loading={screen.signingOut}
                disabled={screen.deleting}
                onPress={() => void screen.signOut()}
                stretch
                testID="account-sign-out"
              />
              <ActionButton
                label={ACCOUNT_COPY.deleteAccount}
                icon={TrashIcon}
                variant="danger"
                loading={screen.deleting}
                disabled={screen.signingOut}
                onPress={() => void screen.deleteAccount()}
                stretch
                testID="account-delete"
              />
              <ThemedText variant="caption" color="textTertiary">
                {ACCOUNT_COPY.deleteFootnote}
              </ThemedText>
            </Section>
          </MotionItem>
        </>
      )}
    </ScreenScaffold>
  );
}
