import { ScrollIcon, StopIcon, TerminalIcon } from "phosphor-react-native";
import type { ProcessInfo } from "@theone/protocol";

import ActionButton from "@/components/action-button";
import ResourceCard from "@/components/resource-card";

import { processMeta } from "../../utils/describe";
import { commandLabel, isActiveProcess } from "../../utils/projects";
import { processTone, stateLabel } from "../../utils/states";

export type ProcessCardProps = {
  process: ProcessInfo;
  onPress?: () => void;
  onStop?: () => void;
  stopping?: boolean;
  onToggleLogs?: () => void;
  logsOpen?: boolean;
};

const ProcessCard = ({ process, onPress, onStop, stopping = false, onToggleLogs, logsOpen = false }: ProcessCardProps) => {
  const active = isActiveProcess(process);

  return (
    <ResourceCard
      icon={TerminalIcon}
      title={process.name}
      subtitle={commandLabel(process.command)}
      monospaceSubtitle
      meta={processMeta(process)}
      badge={{ label: stateLabel(process.state), tone: processTone(process.state) }}
      onPress={onPress}
      footer={
        onToggleLogs || (onStop && active) ? (
          <>
            {onToggleLogs ? (
              <ActionButton
                label={logsOpen ? "Hide logs" : "Logs"}
                icon={ScrollIcon}
                variant="secondary"
                size="sm"
                onPress={onToggleLogs}
              />
            ) : null}
            {onStop && active ? (
              <ActionButton
                label="Stop"
                icon={StopIcon}
                variant="danger"
                size="sm"
                loading={stopping}
                onPress={onStop}
                accessibilityLabel={`Stop ${process.name}`}
              />
            ) : null}
          </>
        ) : undefined
      }
    />
  );
};

export default ProcessCard;
