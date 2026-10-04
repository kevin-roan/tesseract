import { Fragment, useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { SparkleIcon } from "phosphor-react-native";

import KeyValueRow from "@/components/key-value-row";
import ResourceCard from "@/components/resource-card";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

import type { ClaudeStatusView } from "../../utils/status";
import createStyles from "./styles";

export type ClaudeStatusCardProps = {
  view: ClaudeStatusView;
};

const ClaudeStatusCard = ({ view }: ClaudeStatusCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const entering = useEntrance();

  return (
    <Animated.View entering={entering}>
      <ResourceCard icon={SparkleIcon} title={view.title} subtitle={view.subtitle} badge={view.badge}>
        <View style={styles.rows} testID="claude-status-rows">
          {view.rows.map(({ id, label, value }) => (
            <Fragment key={id}>
              <View style={styles.divider} />
              <View style={styles.row}>
                <KeyValueRow label={label} value={value} />
              </View>
            </Fragment>
          ))}
        </View>
      </ResourceCard>
    </Animated.View>
  );
};

export default ClaudeStatusCard;
