import { MonitorIcon, PlayIcon, TerminalIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import Chip from "@/components/chip";
import ResourceCard from "@/components/resource-card";

import { useToggle } from "../../hooks/use-toggle";

export type ScriptCardProps = {
  script: string;
  command: string;
  preferDisplay: boolean;
  onRun: (display: boolean) => void;
  running?: boolean;
};

const ScriptCard = ({ script, command, preferDisplay, onRun, running = false }: ScriptCardProps) => {
  const [display, toggleDisplay] = useToggle(preferDisplay);

  return (
    <ResourceCard
      icon={TerminalIcon}
      title={script}
      subtitle={command}
      monospaceSubtitle
      footer={
        <>
          <Chip label="Show on display" icon={MonitorIcon} selected={display} onPress={toggleDisplay} />
          <ActionButton
            label="Run"
            icon={PlayIcon}
            size="sm"
            loading={running}
            onPress={() => onRun(display)}
            accessibilityLabel={`Run ${script}`}
          />
        </>
      }
    />
  );
};

export default ScriptCard;
