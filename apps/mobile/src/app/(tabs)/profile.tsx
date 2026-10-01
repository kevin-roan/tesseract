import {
  ClockCounterClockwiseIcon,
  InfoIcon,
  SparkleIcon,
} from "phosphor-react-native";

import { ActivityList } from "@/components/activity-item";
import ContentSheet from "@/components/content-sheet";
import EmptyState from "@/components/empty-state";
import ListCard from "@/components/list-card";
import Notice from "@/components/notice";
import ProfileHero from "@/components/profile-hero";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import SandboxGate from "@/features/sandbox/components/sandbox-gate";
import SandboxNotices from "@/features/sandbox/components/sandbox-notices";
import { useProfileScreen } from "@/features/sandbox/hooks/use-profile-screen";
import { useStatusBarStyle } from "@/hooks/use-status-bar-style";

export default function ProfileScreen() {
  const screen = useProfileScreen();
  useStatusBarStyle("light");

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
        menuLabel="Open the sandbox hub"
        onPressMenu={screen.openHub}
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

        <Section title="Configure" testID="profile-configure">
          <ListCard
            icon={SparkleIcon}
            title="Claude account"
            subtitle={screen.claudeAccount}
            onPress={screen.openClaudeAccount}
          />
        </Section>

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
      </ContentSheet>
    </ScreenScaffold>
  );
}
