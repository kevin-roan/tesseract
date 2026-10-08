import { useMemo } from "react";
import { View } from "react-native";
import type { LogLine } from "@tesseract/protocol";
import { WarningCircleIcon } from "phosphor-react-native";

import LogView from "@/components/log-view";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type CloneProgressProps = {
  lines: readonly LogLine[];
  emptyLabel: string;
  failure: string | null;
  onOpenProject: () => void;
};

const CloneProgress = ({ lines, emptyLabel, failure, onOpenProject }: CloneProgressProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.body}>
      {failure ? (
        <MotionItem>
          <Notice
            tone="danger"
            icon={WarningCircleIcon}
            title="Clone failed"
            message={failure}
            actionLabel="Open project"
            onAction={onOpenProject}
          />
        </MotionItem>
      ) : null}
      <MotionItem style={styles.fill}>
        <LogView lines={lines} emptyLabel={emptyLabel} style={styles.log} />
      </MotionItem>
    </View>
  );
};

export default CloneProgress;
