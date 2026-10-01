import { ArrowSquareOutIcon, ScrollIcon, StopIcon, TerminalIcon } from "phosphor-react-native";
import type { ListeningPort, ProcessInfo } from "@theone/protocol";

import ActionButton from "@/components/action-button";
import ResourceCard from "@/components/resource-card";

import { processMeta } from "../../utils/describe";
import { commandLabel, isActiveProcess } from "../../utils/projects";
import { siteLabel, siteUrl } from "../../utils/sites";
import { processTone, stateLabel } from "../../utils/states";

export type ProcessCardProps = {
  process: ProcessInfo;
  onPress?: () => void;
  onStop?: () => void;
  stopping?: boolean;
  onToggleLogs?: () => void;
  logsOpen?: boolean;
  site?: ListeningPort;
  onOpenSite?: (url: string) => void;
};

const ProcessCard = ({
  process,
  onPress,
  onStop,
  stopping = false,
  onToggleLogs,
  logsOpen = false,
  site,
  onOpenSite,
}: ProcessCardProps) => {
  const active = isActiveProcess(process);
  const url = site && onOpenSite && active ? siteUrl(site) : null;

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
        url || onToggleLogs || (onStop && active) ? (
          <>
            {url && site && onOpenSite ? (
              <ActionButton
                label={`Open ${siteLabel(site)}`}
                icon={ArrowSquareOutIcon}
                variant="secondary"
                size="sm"
                onPress={() => onOpenSite(url)}
                accessibilityLabel={`Open ${siteLabel(site)} in browser`}
              />
            ) : null}
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
