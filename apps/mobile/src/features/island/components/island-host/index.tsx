import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { SchemeOverrideContext } from "@/hooks/use-scheme-override";

import { useBackdropFade } from "../../hooks/use-backdrop-fade";
import { useIslandDrag } from "../../hooks/use-island-drag";
import { useIslandHost } from "../../hooks/use-island-host";
import { useIslandMorph } from "../../hooks/use-island-morph";
import { ISLAND_SCHEMES } from "../../utils/constants";
import AttachTargetSheet from "../attach-target-sheet";
import CaptureSheet from "../capture-sheet";
import IslandCapsule from "../island-capsule";
import IslandPanel from "../island-panel";
import IslandShell from "../island-shell";
import createStyles from "./styles";

/** Floating in-app Dynamic Island: a draggable capsule docked to a screen edge that springs open into the live-work panel. Mounted once, paired only. */
const IslandHost = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const island = useIslandHost();
  const backdrop = useBackdropFade(island.expanded);
  const drag = useIslandDrag(island.dock, island.moveTo, !island.expanded);
  const morph = useIslandMorph(island.expanded, drag.x, drag.y, drag.lift);

  return (
    <>
      {island.visible ? (
        <View style={styles.layer} pointerEvents="box-none" testID="island-host">
          <Animated.View pointerEvents={island.expanded ? "auto" : "none"} style={[styles.backdrop, backdrop]}>
            {island.expanded ? (
              <Pressable style={styles.fill} onPress={island.collapse} accessibilityRole="button" accessibilityLabel="Dismiss" />
            ) : null}
          </Animated.View>
          <SchemeOverrideContext.Provider value={ISLAND_SCHEMES[theme.scheme]}>
            <IslandShell frame={morph.frame} clip={morph.clip}>
              <IslandCapsule
                state={island.state}
                sharedCount={island.sharedCount}
                hasDraft={island.hasDraft}
                title={island.title}
                expanded={island.expanded}
                onPress={island.toggle}
                gesture={drag.pan}
                style={morph.capsule}
                testID="island-capsule"
              />
              {island.expanded ? (
                <IslandPanel
                  state={island.state}
                  sharedCount={island.sharedCount}
                  hasDraft={island.hasDraft}
                  stopping={island.stopping}
                  width={morph.panelWidth}
                  onOpen={island.openChat}
                  onStop={island.stop}
                  onCapture={island.capture}
                  onAttach={island.attachShared}
                  onCollapse={island.collapse}
                  style={morph.panel}
                  testID="island-panel"
                />
              ) : null}
            </IslandShell>
          </SchemeOverrideContext.Provider>
        </View>
      ) : null}
      <CaptureSheet />
      <AttachTargetSheet />
    </>
  );
};

export default IslandHost;
