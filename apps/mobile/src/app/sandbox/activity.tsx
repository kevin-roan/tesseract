import { ClockCounterClockwiseIcon } from "phosphor-react-native";

import { ActivityList } from "@/components/activity-item";
import EmptyState from "@/components/empty-state";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import { useActivityScreen } from "@/features/sandbox/hooks/use-activity-screen";
import { ACTIVITY_COPY } from "@/features/sandbox/utils/profile-content";

export default function ActivityScreen() {
  const screen = useActivityScreen();

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      header={<ScreenHeader title={ACTIVITY_COPY.title} subtitle={ACTIVITY_COPY.subtitle} onBack={screen.back} />}
    >
      {screen.error ? (
        <Notice tone="danger" message={screen.error} actionLabel={ACTIVITY_COPY.retry} onAction={screen.retry} />
      ) : null}
      {screen.items.length > 0 ? (
        <MotionItem index={0} testID="activity-feed">
          <ActivityList items={screen.items} />
        </MotionItem>
      ) : screen.error ? null : (
        <EmptyState
          loading={screen.loading}
          icon={ClockCounterClockwiseIcon}
          title={screen.loading ? ACTIVITY_COPY.loading : ACTIVITY_COPY.empty}
          message={screen.loading ? undefined : ACTIVITY_COPY.emptyMessage}
          actionLabel={screen.loading ? undefined : ACTIVITY_COPY.askClaude}
          onAction={screen.loading ? undefined : screen.askClaude}
        />
      )}
    </ScreenScaffold>
  );
}
