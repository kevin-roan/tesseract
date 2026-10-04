import { HardDrivesIcon, InfoIcon, SparkleIcon, SquaresFourIcon, WaveformIcon } from "phosphor-react-native";

import ChoiceGroup from "@/components/choice-group";
import ChoiceList from "@/components/choice-list";
import EmptyState from "@/components/empty-state";
import ListCard from "@/components/list-card";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import { ThemedText } from "@/components/themed-text";
import { useSettingsScreen } from "@/features/settings/hooks/use-settings-screen";
import { SETTINGS_COPY } from "@/features/settings/utils/constants";

export default function SettingsScreen() {
  const screen = useSettingsScreen();
  const { stt } = screen;

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      header={<ScreenHeader title={SETTINGS_COPY.title} subtitle={SETTINGS_COPY.subtitle} onBack={screen.back} />}
    >
      <MotionItem index={0}>
        <Section title={SETTINGS_COPY.sttTitle} loading={stt.loading} testID="settings-stt">
          <ChoiceList
            rows={stt.providerRows}
            onSelect={stt.selectProvider}
            footnote={SETTINGS_COPY.providerFootnote}
            testID="stt-provider"
          />
          {stt.geminiMissing ? (
            <Notice
              tone="info"
              icon={InfoIcon}
              title={SETTINGS_COPY.geminiMissingTitle}
              message={SETTINGS_COPY.geminiMissing}
            />
          ) : null}
          {stt.updateError ? <Notice tone="danger" message={stt.updateError} /> : null}
          {stt.engineIssue ? <Notice tone="warning" message={stt.engineIssue} /> : null}
          {stt.profileRows ? (
            <ChoiceList
              title={SETTINGS_COPY.profileTitle}
              rows={stt.profileRows}
              onSelect={stt.selectProfile}
              footnote={SETTINGS_COPY.profileFootnote}
              testID="stt-profile"
            />
          ) : stt.error ? (
            <EmptyState
              icon={WaveformIcon}
              title={SETTINGS_COPY.sttFailed}
              message={stt.error}
              actionLabel={SETTINGS_COPY.retry}
              onAction={stt.retry}
            />
          ) : null}
        </Section>
      </MotionItem>

      <MotionItem index={1}>
        <Section title={SETTINGS_COPY.sandboxTitle} testID="settings-sandbox">
          <ListCard
            icon={SquaresFourIcon}
            title={screen.hub.title}
            subtitle={screen.hub.subtitle}
            onPress={screen.hub.open}
          />
          <ListCard
            icon={SparkleIcon}
            title={screen.claude.title}
            subtitle={screen.claude.subtitle}
            onPress={screen.claude.open}
          />
          <ListCard
            icon={HardDrivesIcon}
            title={screen.host.title}
            subtitle={screen.host.subtitle}
            onPress={screen.host.open}
          />
        </Section>
      </MotionItem>

      <MotionItem index={2}>
        <Section title={SETTINGS_COPY.displayTitle} testID="settings-display">
          <ChoiceGroup
            label={SETTINGS_COPY.inputModeLabel}
            options={screen.inputMode.options}
            selectedId={screen.inputMode.selectedId}
            onSelect={screen.inputMode.select}
          />
          <ThemedText variant="caption" color="textTertiary">
            {SETTINGS_COPY.inputModeFootnote}
          </ThemedText>
        </Section>
      </MotionItem>

      <MotionItem index={3}>
        <Section title={SETTINGS_COPY.islandTitle} testID="settings-island">
          <ChoiceGroup
            label={SETTINGS_COPY.islandPlacementLabel}
            options={screen.islandPlacement.options}
            selectedId={screen.islandPlacement.selectedId}
            onSelect={screen.islandPlacement.select}
          />
          <ThemedText variant="caption" color="textTertiary">
            {SETTINGS_COPY.islandPlacementFootnote}
          </ThemedText>
          <ChoiceGroup
            label={SETTINGS_COPY.liveActivityLabel}
            options={screen.liveActivity.options}
            selectedId={screen.liveActivity.selectedId}
            onSelect={screen.liveActivity.select}
          />
          <ThemedText variant="caption" color="textTertiary">
            {SETTINGS_COPY.liveActivityFootnote}
          </ThemedText>
        </Section>
      </MotionItem>
    </ScreenScaffold>
  );
}
