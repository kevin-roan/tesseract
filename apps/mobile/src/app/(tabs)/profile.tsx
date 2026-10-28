import {
  ArrowsOutCardinalIcon,
  BellRingingIcon,
  ClockCounterClockwiseIcon,
  CursorClickIcon,
  HardDrivesIcon,
  InfoIcon,
  PaletteIcon,
  RocketLaunchIcon,
  SparkleIcon,
  WaveformIcon,
} from "phosphor-react-native";

import ChoiceList from "@/components/choice-list";
import ContentSheet from "@/components/content-sheet";
import { ListGroup, ListPickerRow, ListRow, ListSwitchRow } from "@/components/list-group";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import ProfileHero from "@/components/profile-hero";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import { useHostEntry } from "@/features/host-shell/hooks/use-host-entry";
import SandboxGate from "@/features/sandbox/components/sandbox-gate";
import SandboxNotices from "@/features/sandbox/components/sandbox-notices";
import { useProfileScreen } from "@/features/sandbox/hooks/use-profile-screen";
import { PROFILE_COPY } from "@/features/sandbox/utils/profile-content";
import { usePreferences } from "@/features/settings/hooks/use-preferences";
import { SETTINGS_COPY } from "@/features/settings/utils/constants";

export default function ProfileScreen() {
  const screen = useProfileScreen();
  const prefs = usePreferences();
  const hostEntry = useHostEntry();

  if (!screen.sandbox || !screen.profile) {
    return <SandboxGate />;
  }

  return (
    <ScreenScaffold
      edges={["left", "right", "bottom"]}
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
    >
      <ProfileHero
        name={screen.profile.name}
        tagline={screen.profile.tagline}
        team={screen.profile.team}
        photo={screen.profile.photo}
        stats={screen.stats}
        nameTestID="profile-name"
        teamTestID="profile-tailnet"
      />

      <ContentSheet>
        <SandboxNotices
          missingToken={screen.missingToken}
          onPair={screen.nav.pair}
          issue={screen.issue}
          onRepair={screen.repair}
          error={screen.statusError}
          onRetry={screen.retryStatus}
        />
        {screen.tailscaleMissing ? (
          <Notice
            tone="info"
            icon={InfoIcon}
            title={PROFILE_COPY.tailscaleMissingTitle}
            message={PROFILE_COPY.tailscaleMissing}
          />
        ) : null}
        {screen.identityError ? (
          <Notice
            tone="danger"
            message={screen.identityError}
            actionLabel={PROFILE_COPY.retry}
            onAction={screen.retryIdentity}
          />
        ) : null}

        <MotionItem index={0}>
          <Section
            title={PROFILE_COPY.sandboxTitle}
            actionLabel={PROFILE_COPY.pairAnother}
            onPressAction={screen.pairSandbox}
            testID="profile-sandbox"
          >
            <ChoiceList
              rows={screen.sandboxes}
              onSelect={screen.selectSandbox}
              testID="profile-sandbox-choice"
            />
          </Section>
        </MotionItem>

        <MotionItem index={1}>
          <Section title={PROFILE_COPY.accountTitle} testID="profile-account">
            <ListGroup>
              <ListRow
                icon={SparkleIcon}
                label={screen.claudeAccountTitle}
                detail={screen.claudeAccount}
                chevron
                onPress={screen.openClaudeAccount}
                testID="profile-claude"
              />
              <ListRow
                icon={HardDrivesIcon}
                label={hostEntry.title}
                detail={hostEntry.subtitle}
                chevron
                onPress={hostEntry.open}
                testID="profile-host"
              />
            </ListGroup>
          </Section>
        </MotionItem>

        <MotionItem index={2}>
          <Section title={PROFILE_COPY.preferencesTitle} testID="profile-preferences">
            <ListGroup footnote={SETTINGS_COPY.liveActivityFootnote}>
              <ListPickerRow
                icon={PaletteIcon}
                label={SETTINGS_COPY.appearanceLabel}
                options={prefs.appearance.options}
                selectedId={prefs.appearance.selectedId}
                onSelect={prefs.appearance.select}
                footnote={SETTINGS_COPY.appearanceFootnote}
                testID="profile-appearance"
              />
              <ListRow
                icon={WaveformIcon}
                label={prefs.voice.title}
                value={prefs.voice.value}
                chevron
                onPress={prefs.voice.open}
                testID="profile-voice"
              />
              <ListPickerRow
                icon={CursorClickIcon}
                label={SETTINGS_COPY.inputModeLabel}
                options={prefs.inputMode.options}
                selectedId={prefs.inputMode.selectedId}
                onSelect={prefs.inputMode.select}
                footnote={SETTINGS_COPY.inputModeFootnote}
                testID="profile-input-mode"
              />
              <ListPickerRow
                icon={ArrowsOutCardinalIcon}
                label={SETTINGS_COPY.islandPlacementLabel}
                options={prefs.islandPlacement.options}
                selectedId={prefs.islandPlacement.selectedId}
                onSelect={prefs.islandPlacement.select}
                footnote={SETTINGS_COPY.islandPlacementFootnote}
                testID="profile-island"
              />
              <ListSwitchRow
                icon={BellRingingIcon}
                label={SETTINGS_COPY.liveActivityLabel}
                value={prefs.liveActivity.value}
                onValueChange={prefs.liveActivity.set}
                testID="profile-live-activity"
              />
            </ListGroup>
          </Section>
        </MotionItem>

        <MotionItem index={3}>
          <Section title={PROFILE_COPY.moreTitle} testID="profile-more">
            <ListGroup>
              <ListRow
                icon={ClockCounterClockwiseIcon}
                label={screen.activity.title}
                detail={screen.activity.subtitle}
                chevron
                onPress={screen.activity.open}
                testID="profile-activity"
              />
              <ListRow
                icon={RocketLaunchIcon}
                label={prefs.about.title}
                detail={prefs.about.subtitle}
                chevron
                onPress={prefs.about.open}
                testID="profile-about"
              />
            </ListGroup>
          </Section>
        </MotionItem>
      </ContentSheet>
    </ScreenScaffold>
  );
}
