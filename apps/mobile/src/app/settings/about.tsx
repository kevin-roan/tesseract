import { ArrowClockwiseIcon, ArrowsClockwiseIcon, InfoIcon, WarningIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import KeyValueList from "@/components/key-value-list";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import Wordmark from "@/components/wordmark";
import { useAboutScreen } from "@/features/settings/hooks/use-about-screen";
import { ABOUT_COPY } from "@/features/settings/utils/constants";

export default function AboutScreen() {
  const screen = useAboutScreen();
  const { updates } = screen;

  return (
    <ScreenScaffold header={<ScreenHeader title={ABOUT_COPY.title} subtitle={ABOUT_COPY.subtitle} onBack={screen.back} />}>
      <MotionItem index={0} style={{ alignItems: "center" }}>
        <Wordmark testID="about-wordmark" />
      </MotionItem>

      <MotionItem index={1}>
        <Section title={ABOUT_COPY.appTitle} testID="about-app">
          <KeyValueList items={screen.appRows} testID="about-app-rows" />
        </Section>
      </MotionItem>

      <MotionItem index={2}>
        <Section title={ABOUT_COPY.updatesTitle} testID="about-updates">
          <KeyValueList items={screen.updateRows} testID="about-update-rows" />
          {updates.emergencyReason ? (
            <Notice tone="warning" icon={WarningIcon} title={ABOUT_COPY.emergencyTitle} message={updates.emergencyReason} />
          ) : null}
          {updates.enabled ? (
            <>
              {updates.checkError ? (
                <Notice tone="danger" title={ABOUT_COPY.checkFailed} message={updates.checkError} />
              ) : null}
              {updates.downloadError ? (
                <Notice tone="danger" title={ABOUT_COPY.downloadFailed} message={updates.downloadError} />
              ) : null}
              <ThemedText variant="caption" color="textTertiary">
                {updates.statusText}
              </ThemedText>
              {updates.pending ? (
                <ActionButton
                  label={ABOUT_COPY.restartLabel}
                  icon={ArrowClockwiseIcon}
                  onPress={updates.restart}
                  testID="about-restart"
                />
              ) : (
                <ActionButton
                  label={ABOUT_COPY.checkLabel}
                  icon={ArrowsClockwiseIcon}
                  variant="secondary"
                  loading={updates.busy}
                  disabled={updates.busy}
                  onPress={updates.check}
                  testID="about-check"
                />
              )}
            </>
          ) : (
            <Notice tone="info" icon={InfoIcon} title={ABOUT_COPY.disabledTitle} message={ABOUT_COPY.disabledMessage} />
          )}
        </Section>
      </MotionItem>
    </ScreenScaffold>
  );
}
