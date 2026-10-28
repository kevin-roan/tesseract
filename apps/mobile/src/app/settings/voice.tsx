import { InfoIcon, WaveformIcon } from "phosphor-react-native";

import ChoiceList from "@/components/choice-list";
import EmptyState from "@/components/empty-state";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import SecretField from "@/components/secret-field";
import Section from "@/components/section";
import { useVoiceScreen } from "@/features/settings/hooks/use-voice-screen";
import { SETTINGS_COPY } from "@/features/settings/utils/constants";

export default function VoiceScreen() {
  const { stt, ...screen } = useVoiceScreen();

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      header={<ScreenHeader title={SETTINGS_COPY.sttTitle} subtitle={SETTINGS_COPY.sttSubtitle} onBack={screen.back} />}
    >
      <MotionItem index={0}>
        <Section title={SETTINGS_COPY.sttEngineTitle} loading={stt.loading} testID="voice-provider">
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
          {stt.geminiKey ? (
            <SecretField
              label={SETTINGS_COPY.geminiKeyLabel}
              placeholder={SETTINGS_COPY.geminiKeyPlaceholder}
              hint={stt.geminiKey.hint}
              value={stt.geminiKey.value}
              onChange={stt.geminiKey.onChange}
              saveLabel={SETTINGS_COPY.geminiKeySave}
              onSave={stt.geminiKey.save}
              saving={stt.geminiKey.saving}
              removeLabel={SETTINGS_COPY.geminiKeyRemove}
              onRemove={stt.geminiKey.remove}
              removing={stt.geminiKey.removing}
              testID="gemini-key"
            />
          ) : null}
          {stt.updateError ? <Notice tone="danger" message={stt.updateError} /> : null}
        </Section>
      </MotionItem>

      <MotionItem index={1}>
        <Section title={SETTINGS_COPY.profileTitle} testID="voice-native">
          {stt.engineIssue ? <Notice tone="warning" message={stt.engineIssue} /> : null}
          {stt.profileRows ? (
            <ChoiceList
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
    </ScreenScaffold>
  );
}
