import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";

import { useBackdropFade } from "../../hooks/use-backdrop-fade";
import { useIslandHost } from "../../hooks/use-island-host";
import { useIslandMotion } from "../../hooks/use-island-motion";
import { useOrbDrag } from "../../hooks/use-orb-drag";
import { elapsedLabel, liveCountLabel } from "../../utils/format";
import AttachTargetSheet from "../attach-target-sheet";
import CaptureSheet from "../capture-sheet";
import IslandCard from "../island-card";
import IslandOrb from "../island-orb";
import createStyles from "./styles";

/** Floating in-app island: a chrome orb docked to any screen edge that opens into the live-work card. Mounted once, paired only. */
const IslandHost = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const island = useIslandHost();
  const motion = useIslandMotion();
  const backdrop = useBackdropFade(island.expanded);
  const orb = useOrbDrag(island.dock, island.moveTo);
  const label = useMemo(() => {
    const [run] = island.state.runs;
    const badge =
      island.count > 1
        ? liveCountLabel(island.count)
        : run
          ? elapsedLabel(run.startedAt, island.now)
          : island.sharedCount > 0
            ? String(island.sharedCount)
            : "";
    return badge ? `${island.title}, ${badge}` : island.title;
  }, [island.count, island.state.runs, island.now, island.sharedCount, island.title]);

  return (
    <>
      {island.visible ? (
        <View style={styles.layer} pointerEvents="box-none" testID="island-host">
          <Animated.View pointerEvents={island.expanded ? "auto" : "none"} style={[styles.backdrop, backdrop]}>
            {island.expanded ? (
              <Pressable style={styles.fill} onPress={island.collapse} accessibilityRole="button" accessibilityLabel="Dismiss" />
            ) : null}
          </Animated.View>
          {island.expanded ? (
            <Animated.View
              key="card"
              entering={motion.open}
              exiting={motion.fadeOut}
              style={[styles.card, orb.card]}
              pointerEvents="box-none"
            >
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
            </Animated.View>
          ) : null}
          <IslandOrb
            label={label}
            count={island.count > 1 ? island.count : island.count === 0 ? island.sharedCount : 0}
            live={island.count > 0}
            expanded={island.expanded}
            onPress={island.toggle}
            gesture={orb.pan}
            lift={orb.lift}
            sheen={orb.sheenTransform}
            style={orb.style}
            testID="island-orb"
          />
        </View>
      ) : null}
      <CaptureSheet />
      <AttachTargetSheet />
    </>
  );
};

export default IslandHost;
