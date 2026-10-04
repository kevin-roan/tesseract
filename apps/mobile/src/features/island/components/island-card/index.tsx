import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { ArrowSquareOutIcon, CropIcon, PaperclipIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import { Surface } from "@/components/surface";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { IslandState } from "@/modules/theone-island";

import { useIslandMotion } from "../../hooks/use-island-motion";
import { islandStats } from "../../utils/stats";
import { elapsedLabel, tokensLabel } from "../../utils/format";
import IslandHeader from "../island-header";
import IslandRow from "../island-row";
import IslandSection from "../island-section";
import IslandStats from "../island-stats";
import createStyles from "./styles";

export type IslandCardProps = {
  state: IslandState;
  now: number;
  sharedCount: number;
  stoppingRunId: string | null;
  stoppingCommandId: string | null;
  onCollapse: () => void;
  onOpenRun: (id: string) => void;
  onStopRun: (id: string) => void;
  onStopCommand: (id: string) => void;
  onCapture: () => void;
  onOpen: () => void;
  onAttachShared: () => void;
  testID?: string;
};

const IslandCard = ({
  state,
  now,
  sharedCount,
  stoppingRunId,
  stoppingCommandId,
  onCollapse,
  onOpenRun,
  onStopRun,
  onStopCommand,
  onCapture,
  onOpen,
  onAttachShared,
  testID,
}: IslandCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const live = state.runs.length + state.commands.length > 0;
  const stats = useMemo(() => islandStats(state.usage), [state.usage]);
  const motion = useIslandMotion();

  return (
    <Surface style={styles.card} testID={testID}>
      <IslandHeader
        name={state.sandboxName}
        status={live ? "Live" : "Idle"}
        tone={live ? "success" : "neutral"}
        onCollapse={onCollapse}
      />
      <Animated.View entering={motion.fadeIn} layout={motion.layout} style={styles.body}>
        <IslandSection title="Workflows" count={state.runs.length} emptyLabel="No Claude runs in progress">
          {state.runs.map((run) => (
            <IslandRow
              key={run.id}
              title={run.title}
              details={[run.project, elapsedLabel(run.startedAt, now), tokensLabel(run.tokens)]}
              stopLabel="Stop"
              stopping={stoppingRunId === run.id}
              onStop={() => onStopRun(run.id)}
              onPress={() => onOpenRun(run.id)}
              testID={`island-run-${run.id}`}
            />
          ))}
        </IslandSection>
        <IslandSection title="Commands" count={state.commands.length}>
          {state.commands.map((command) => (
            <IslandRow
              key={command.id}
              title={command.label}
              details={[command.project, command.state]}
              stopLabel="Cancel"
              stopping={stoppingCommandId === command.id}
              onStop={() => onStopCommand(command.id)}
              testID={`island-command-${command.id}`}
            />
          ))}
        </IslandSection>
        <IslandSection title="Usage">
          <IslandStats stats={stats} />
        </IslandSection>
        {sharedCount > 0 ? (
          <Animated.View entering={motion.fadeIn} exiting={motion.fadeOut} layout={motion.layout}>
            <ActionButton
              label={sharedCount === 1 ? "Attach shared item" : `Attach ${sharedCount} shared items`}
              icon={PaperclipIcon}
              variant="secondary"
              onPress={onAttachShared}
              stretch
            />
          </Animated.View>
        ) : null}
        <Animated.View layout={motion.layout} style={styles.actions}>
          <View style={styles.action}>
            <ActionButton label="Capture" icon={CropIcon} onPress={onCapture} stretch />
          </View>
          <View style={styles.action}>
            <ActionButton label="Open" icon={ArrowSquareOutIcon} variant="secondary" onPress={onOpen} stretch />
          </View>
        </Animated.View>
      </Animated.View>
    </Surface>
  );
};

export default IslandCard;
