import { useContext, useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { Springs } from "@/theme";

import { useIslandHost } from "../../hooks/use-island-host";
import { elapsedLabel, liveCountLabel } from "../../utils/format";
import AttachTargetSheet from "../attach-target-sheet";
import CaptureSheet from "../capture-sheet";
import IslandCapsule from "../island-capsule";
import IslandCard from "../island-card";
import createStyles from "./styles";

const layout = LinearTransition.springify().damping(Springs.gentle.damping).stiffness(Springs.gentle.stiffness);

/** Floating in-app island: a capsule over the navigator that opens into the live-work card. Mounted once, paired only. */
const IslandHost = () => {
  const theme = useAppTheme();
  const topInset = useContext(SafeAreaInsetsContext)?.top ?? 0;
  const styles = useMemo(() => createStyles(theme, topInset), [theme, topInset]);
  const island = useIslandHost();
  const badge = useMemo(() => {
    const [run] = island.state.runs;
    if (island.count > 1) return liveCountLabel(island.count);
    if (run) return elapsedLabel(run.startedAt, island.now) || null;
    return island.sharedCount > 0 ? String(island.sharedCount) : null;
  }, [island.count, island.state.runs, island.now, island.sharedCount]);

  return (
    <>
      {island.visible ? (
        <View style={styles.layer} pointerEvents="box-none" testID="island-host">
          {island.expanded ? (
            <Pressable style={styles.backdrop} onPress={island.collapse} accessibilityRole="button" accessibilityLabel="Dismiss" />
          ) : null}
          <Animated.View layout={layout} style={styles.island} pointerEvents="box-none">
            {island.expanded ? (
              <IslandCard
                state={island.state}
                now={island.now}
                sharedCount={island.sharedCount}
                stoppingRunId={island.stoppingRunId}
                stoppingCommandId={island.stoppingCommandId}
                onCollapse={island.collapse}
                onOpenRun={island.openRun}
                onStopRun={island.stopRun}
                onStopCommand={island.stopCommand}
                onCapture={island.capture}
                onOpen={island.openHub}
                onAttachShared={island.attachShared}
                testID="island-card"
              />
            ) : (
              <IslandCapsule title={island.title} badge={badge} onPress={island.toggle} testID="island-capsule" />
            )}
          </Animated.View>
        </View>
      ) : null}
      <CaptureSheet />
      <AttachTargetSheet />
    </>
  );
};

export default IslandHost;
