import type { ReactNode } from "react";
import { ArrowSquareOutIcon, CaretDownIcon, CaretUpIcon, SparkleIcon, StopIcon, TerminalIcon } from "phosphor-react-native";
import type { ListeningPort, ProcessInfo } from "@tesseract/protocol";

import ActionButton from "@/components/action-button";
import ResourceCard from "@/components/resource-card";

import { processMeta } from "../../utils/describe";
import { canFixProcess } from "../../utils/fix-prompt";
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
  /** The log view, rendered inside the card while `logsOpen`. */
  logs?: ReactNode;
  site?: ListeningPort;
  onOpenSite?: (url: string) => void;
  /** Shown once the process has failed: hands its logs to a new chat. */
  onFix?: () => void;
  fixing?: boolean;
};

const ProcessCard = ({
  process,
  onPress,
  onStop,
  stopping = false,
  onToggleLogs,
  logsOpen = false,
  logs,
  site,
  onOpenSite,
  onFix,
  fixing = false,
}: ProcessCardProps) => {
  const active = isActiveProcess(process);
  const fix = onFix && canFixProcess(process) ? onFix : null;
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
        url || fix || onToggleLogs || (onStop && active) ? (
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
            {fix ? (
              <ActionButton
                label="Fix with AI"
                icon={SparkleIcon}
                variant="secondary"
                size="sm"
                loading={fixing}
                onPress={fix}
                accessibilityLabel={`Fix ${process.name} with AI`}
              />
            ) : null}
            {onToggleLogs ? (
              <ActionButton
                label={logsOpen ? "Hide logs" : "Logs"}
                icon={logsOpen ? CaretUpIcon : CaretDownIcon}
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
      expanded={logsOpen ? logs : null}
    />
  );
};

export default ProcessCard;
