import { SparkleIcon, TerminalWindowIcon, XIcon } from "phosphor-react-native";
import type { TerminalInfo } from "@theone/protocol";

import ActionButton from "@/components/action-button";
import ResourceCard from "@/components/resource-card";

import { terminalMeta } from "../../utils/describe";
import { terminalKindLabel } from "../../utils/labels";
import { stateLabel, terminalTone } from "../../utils/states";

export type TerminalCardProps = {
  terminal: TerminalInfo;
  /** Display name of the session's project; the project id stands in when omitted. */
  projectName?: string | null;
  onOpen: () => void;
  onClose?: () => void;
  closing?: boolean;
};

const TerminalCard = ({ terminal, projectName, onOpen, onClose, closing = false }: TerminalCardProps) => (
  <ResourceCard
    icon={terminal.kind === "claude" ? SparkleIcon : TerminalWindowIcon}
    title={terminal.title || terminalKindLabel(terminal.kind)}
    subtitle={terminal.cwd}
    monospaceSubtitle
    meta={terminalMeta(terminal, projectName)}
    badge={{ label: stateLabel(terminal.state), tone: terminalTone(terminal.state) }}
    onPress={onOpen}
    footer={
      onClose && terminal.state === "running" ? (
        <ActionButton
          label="Close session"
          icon={XIcon}
          variant="secondary"
          size="sm"
          loading={closing}
          onPress={onClose}
        />
      ) : undefined
    }
  />
);

export default TerminalCard;
