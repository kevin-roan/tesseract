import type { ReactNode } from "react";
import { ArrowUpRightIcon, BookmarkSimpleIcon, CaretDownIcon, CaretUpIcon, MonitorIcon, PlayIcon, SparkleIcon, StopIcon, TerminalIcon } from "phosphor-react-native";
import type { ProcessInfo } from "@tesseract/protocol";

import ActionButton from "@/components/action-button";
import Chip from "@/components/chip";
import IconButton from "@/components/icon-button";
import ResourceCard from "@/components/resource-card";

import { useToggle } from "../../hooks/use-toggle";
import { processMeta } from "../../utils/describe";
import { canFixProcess } from "../../utils/fix-prompt";
import { isActiveProcess } from "../../utils/projects";
import { processTone, stateLabel } from "../../utils/states";

export type ScriptCardProps = {
  script: string;
  command: string;
  preferDisplay: boolean;
  /** Off for Android projects, which open their app on the host emulator instead of the display. */
  offerDisplay?: boolean;
  onRun: (display: boolean) => void;
  /** Opens the screen the run is drawing on, shown while it runs on the display. */
  onShowDisplay?: () => void;
  running?: boolean;
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  /** The latest run of this script; its state and logs show on the card. */
  run?: ProcessInfo;
  logsOpen?: boolean;
  onToggleLogs?: () => void;
  /** The log view, rendered inside the card while `logsOpen`. */
  logs?: ReactNode;
  onStop?: () => void;
  stopping?: boolean;
  /** Shown once the run has failed: hands its logs to a new chat. */
  onFix?: () => void;
  fixing?: boolean;
};

const ScriptCard = ({
  script,
  command,
  preferDisplay,
  offerDisplay = true,
  onRun,
  onShowDisplay,
  running = false,
  bookmarked = false,
  onToggleBookmark,
  run,
  logsOpen = false,
  onToggleLogs,
  logs,
  onStop,
  stopping = false,
  onFix,
  fixing = false,
}: ScriptCardProps) => {
  const [display, toggleDisplay] = useToggle(preferDisplay);
  const active = run ? isActiveProcess(run) : false;
  const fixable = run ? canFixProcess(run) : false;
  const onDisplay = active && run?.display === true && onShowDisplay !== undefined;

  return (
    <ResourceCard
      icon={TerminalIcon}
      title={script}
      subtitle={command}
      monospaceSubtitle
      meta={run ? processMeta(run) : undefined}
      badge={run ? { label: stateLabel(run.state), tone: processTone(run.state) } : undefined}
      accessory={
        onToggleBookmark ? (
          <IconButton
            icon={BookmarkSimpleIcon}
            label={bookmarked ? `Remove bookmark from ${script}` : `Bookmark ${script}`}
            filled={bookmarked}
            size="md"
            onPress={onToggleBookmark}
          />
        ) : null
      }
      footer={
        <>
          {onDisplay ? (
            <ActionButton
              label="Show on display"
              icon={ArrowUpRightIcon}
              variant="secondary"
              size="sm"
              onPress={onShowDisplay}
              accessibilityLabel={`Show ${script} on the display`}
            />
          ) : active || !offerDisplay ? null : (
            <Chip label="Run on display" icon={MonitorIcon} selected={display} onPress={toggleDisplay} />
          )}
          {active && onStop ? (
            <ActionButton
              label="Stop"
              icon={StopIcon}
              variant="danger"
              size="sm"
              loading={stopping}
              onPress={onStop}
              accessibilityLabel={`Stop ${script}`}
            />
          ) : (
            <ActionButton
              label={run ? "Run again" : "Run"}
              icon={PlayIcon}
              size="sm"
              loading={running}
              onPress={() => onRun(offerDisplay && display)}
              accessibilityLabel={`Run ${script}`}
            />
          )}
          {fixable && onFix ? (
            <ActionButton
              label="Fix with AI"
              icon={SparkleIcon}
              variant="secondary"
              size="sm"
              loading={fixing}
              onPress={onFix}
              accessibilityLabel={`Fix ${script} with AI`}
            />
          ) : null}
          {run && onToggleLogs ? (
            <ActionButton
              label={logsOpen ? "Hide logs" : "Logs"}
              icon={logsOpen ? CaretUpIcon : CaretDownIcon}
              variant="secondary"
              size="sm"
              onPress={onToggleLogs}
              accessibilityLabel={logsOpen ? `Hide ${script} logs` : `Show ${script} logs`}
            />
          ) : null}
        </>
      }
      expanded={logsOpen ? logs : null}
    />
  );
};

export default ScriptCard;
