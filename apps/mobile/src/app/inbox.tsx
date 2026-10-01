import { TrayIcon, WarningIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
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

  return (
    <ScreenScaffold
      refreshing={inbox.refreshing}
      onRefresh={inbox.paired ? inbox.refresh : undefined}
      header={<ScreenHeader title="Inbox" subtitle={subtitle} onBack={inbox.back} actions={inbox.headerActions} />}
    >
      {!inbox.hydrated || inbox.loading ? (
        <SkeletonList count={3} height={88} radius="lg" />
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
          {inbox.markError ? <Notice tone="danger" message={inbox.markError} /> : null}
          {inbox.downloadError ? <Notice tone="danger" icon={WarningIcon} message={inbox.downloadError} /> : null}
          {inbox.sections.map((section) => (
            <Section key={section.id} title={section.title} testID={`inbox-section-${section.id}`}>
              {section.items.map((item) => (
                <InboxRow
                  key={item.id}
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
