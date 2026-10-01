import { useMemo } from "react";
import { View } from "react-native";
import { SparkleIcon } from "phosphor-react-native";

import KeyValueRow from "@/components/key-value-row";
import ResourceCard from "@/components/resource-card";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { ClaudeStatusView } from "../../utils/status";
import createStyles from "./styles";

export type ClaudeStatusCardProps = {
  view: ClaudeStatusView;
};

const ClaudeStatusCard = ({ view }: ClaudeStatusCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <ResourceCard icon={SparkleIcon} title={view.title} subtitle={view.subtitle} badge={view.badge}>
      <View style={styles.rows} testID="claude-status-rows">
        {view.rows.map(({ id, label, value }) => (
          <KeyValueRow key={id} label={label} value={value} />
        ))}
      </View>
    </ResourceCard>
  );
};

export default ClaudeStatusCard;
