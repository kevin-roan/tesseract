import {
  ClockCounterClockwiseIcon,
  GearSixIcon,
  HardDrivesIcon,
  InfoIcon,
  SparkleIcon,
} from "phosphor-react-native";
import Animated from "react-native-reanimated";

import { ActivityList } from "@/components/activity-item";
import ContentSheet from "@/components/content-sheet";
import EmptyState from "@/components/empty-state";
import ListCard from "@/components/list-card";
import Notice from "@/components/notice";
import ProfileHero from "@/components/profile-hero";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import { useHostEntry } from "@/features/host-shell/hooks/use-host-entry";
import SandboxGate from "@/features/sandbox/components/sandbox-gate";
import SandboxNotices from "@/features/sandbox/components/sandbox-notices";
import { useProfileScreen } from "@/features/sandbox/hooks/use-profile-screen";
import { useEntrance } from "@/hooks/use-entrance";
import { useStatusBarStyle } from "@/hooks/use-status-bar-style";

export default function ProfileScreen() {
  const screen = useProfileScreen();
  const hostEntry = useHostEntry();
  useStatusBarStyle("light");
  const configureEntering = useEntrance(0);
  const activityEntering = useEntrance(1);

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
        menuLabel="Open settings"
        menuIcon={GearSixIcon}
        onPressMenu={screen.openSettings}
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
            title="Tailscale identity not exposed"
            message="This sandbox doesn't share who you are on the tailnet. Start it with --tailscale-api (THEONE_TAILSCALE_LOCALAPI=1) to show your Tailscale profile."
          />
        ) : null}
        {screen.identityError ? (
          <Notice
            tone="danger"
            message={screen.identityError}
            actionLabel="Retry"
            onAction={screen.retryIdentity}
          />
        ) : null}

        <Animated.View entering={configureEntering}>
          <Section title="Configure" testID="profile-configure">
            <ListCard
              icon={SparkleIcon}
              title={screen.claudeAccountTitle}
              subtitle={screen.claudeAccount}
              onPress={screen.openClaudeAccount}
            />
            <ListCard
              icon={HardDrivesIcon}
              title={hostEntry.title}
              subtitle={hostEntry.subtitle}
              onPress={hostEntry.open}
            />
          </Section>
        </Animated.View>

        <Animated.View entering={activityEntering}>
          <Section title="Activity" testID="profile-activity">
            {screen.activityError ? (
              <Notice
                tone="danger"
                message={screen.activityError}
                actionLabel="Retry"
                onAction={screen.retryActivity}
              />
            ) : null}
            {screen.activity.length > 0 ? (
              <ActivityList items={screen.activity} />
            ) : screen.activityError ? null : (
              <EmptyState
                loading={screen.activityLoading}
                icon={ClockCounterClockwiseIcon}
                title={
                  screen.activityLoading ? "Loading activity…" : "No activity yet"
                }
                message={
                  screen.activityLoading
                    ? undefined
                    : "Builds, Claude runs and processes on this sandbox show up here."
                }
                actionLabel={screen.activityLoading ? undefined : "Ask Claude"}
                onAction={
                  screen.activityLoading
                    ? undefined
                    : () => screen.nav.newAgentRun()
                }
              />
            )}
          </Section>
        </Animated.View>
      </ContentSheet>
    </ScreenScaffold>
  );
}
