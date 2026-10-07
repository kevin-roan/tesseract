import { TrayIcon, WarningIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import SegmentedPills from "@/components/segmented-pills";
import { SkeletonList } from "@/components/skeleton";
import InboxRow from "@/features/inbox/components/inbox-row";
import { useInboxScreen } from "@/features/inbox/hooks/use-inbox-screen";
import { pluralize } from "@/features/sandbox/utils/format";

export default function InboxScreen() {
  const inbox = useInboxScreen();
  const subtitle =
    inbox.attentionCount > 0
      ? `${pluralize(inbox.attentionCount, "item")} waiting on you`
      : inbox.unreadCount > 0
        ? `${inbox.unreadCount} unread`
        : undefined;
  const sectionOffsets = inbox.sections.map((_, sectionIndex) =>
    inbox.sections.slice(0, sectionIndex).reduce((total, previous) => total + previous.items.length, 0),
  );

  return (
    <ScreenScaffold
      refreshing={inbox.refreshing}
      onRefresh={inbox.paired ? inbox.refresh : undefined}
      header={<ScreenHeader title="Inbox" subtitle={subtitle} onBack={inbox.back} actions={inbox.headerActions} />}
    >
      {!inbox.hydrated || inbox.loading ? (
        <SkeletonList count={4} height={72} radius="card" />
      ) : !inbox.paired ? (
        <EmptyState
          icon={TrayIcon}
          title="No sandbox paired"
          message="Pair a sandbox to see when Claude needs you."
          actionLabel="Pair a sandbox"
          onAction={inbox.pair}
        />
      ) : inbox.error ? (
        <Notice tone="danger" icon={WarningIcon} title="Inbox is unavailable" message={inbox.error} actionLabel="Retry" onAction={inbox.retry} />
      ) : inbox.sections.length === 0 ? (
        <EmptyState
          icon={TrayIcon}
          title="Nothing needs you"
          message="When Claude asks a question, wants permission, finishes a task or shares a file, it lands here."
        />
      ) : (
        <>
          {inbox.projectOptions.length > 0 ? (
            <SegmentedPills
              options={inbox.projectOptions}
              value={inbox.projectFilter}
              onChange={inbox.selectProject}
              scrollable
              label="Filter by project"
            />
          ) : null}
          {inbox.markError ? <Notice tone="danger" message={inbox.markError} /> : null}
          {inbox.sections.map((section, sectionIndex) => (
            <Section key={section.id} title={section.title} testID={`inbox-section-${section.id}`}>
              {section.items.map((item, itemIndex) => (
                <InboxRow
                  key={item.id}
                  index={sectionOffsets[sectionIndex] + itemIndex}
                  item={item}
                  project={inbox.projectName(item.projectId)}
                  onPress={() => inbox.open(item)}
                  onLongPress={() => inbox.markOne(item)}
                />
              ))}
            </Section>
          ))}
        </>
      )}
    </ScreenScaffold>
  );
}
