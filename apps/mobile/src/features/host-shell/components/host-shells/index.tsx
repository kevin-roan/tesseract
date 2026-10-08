import { TerminalWindowIcon } from "phosphor-react-native";
import type { TerminalInfo } from "@tesseract/protocol";

import ActionButton from "@/components/action-button";
import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import Section from "@/components/section";
import TagChip from "@/components/tag-chip";
import TerminalCard from "@/features/sandbox/components/terminal-card";

import { HOST_ACTIONS, HOST_SCREEN } from "../../utils/content";

export type HostShellsProps = {
  list: TerminalInfo[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  closingId: string | null | undefined;
  sessionChip: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  onRetry: () => void;
};

const HostShells = ({ list, loading, error, creating, closingId, sessionChip, onOpen, onCreate, onClose, onRetry }: HostShellsProps) => (
  <>
    {error ? <Notice tone="danger" message={error} actionLabel={HOST_SCREEN.retry} onAction={onRetry} /> : null}
    <TagChip label={sessionChip} tone="success" dot />
    <ActionButton label={HOST_SCREEN.newShell} icon={HOST_ACTIONS.newShell.icon} onPress={onCreate} loading={creating} stretch />
    <Section title={HOST_SCREEN.sessionsTitle}>
      {list.length > 0 ? (
        list.map((terminal) => (
          <TerminalCard
            key={terminal.id}
            terminal={terminal}
            onOpen={() => onOpen(terminal.id)}
            onClose={() => onClose(terminal.id)}
            closing={closingId === terminal.id}
          />
        ))
      ) : (
        <EmptyState
          loading={loading}
          icon={TerminalWindowIcon}
          title={loading ? HOST_SCREEN.loadingTitle : HOST_SCREEN.emptyTitle}
          message={loading ? undefined : HOST_SCREEN.emptyMessage}
        />
      )}
    </Section>
  </>
);

export default HostShells;
