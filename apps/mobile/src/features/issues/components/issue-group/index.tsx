import { useMemo } from "react";
import { View } from "react-native";
import { CaretDownIcon, CaretRightIcon } from "phosphor-react-native";
import type { Issue } from "@tesseract/protocol";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, IconSize } from "@/theme";

import { ISSUE_STATUS_LABELS, ISSUES_COPY } from "../../utils/content";
import type { IssueGroup as IssueGroupData } from "../../utils/issues";
import IssueRow from "../issue-row";
import IssueStatusIcon from "../issue-status-icon";
import createStyles from "./styles";

export type IssueGroupProps = {
  group: IssueGroupData;
  collapsed: boolean;
  onToggle: () => void;
  onOpen: (issue: Issue) => void;
  onLongPress?: (issue: Issue) => void;
  indexOffset?: number;
};

const IssueGroup = ({ group, collapsed, onToggle, onOpen, onLongPress, indexOffset = 0 }: IssueGroupProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const label = ISSUE_STATUS_LABELS[group.status];
  const Caret = collapsed ? CaretRightIcon : CaretDownIcon;

  return (
    <View style={styles.group} testID={`issue-group-${group.status}`}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${group.issues.length}`}
        accessibilityHint={collapsed ? ISSUES_COPY.expand(label) : ISSUES_COPY.collapse(label)}
        accessibilityState={{ expanded: !collapsed }}
        hitSlop={HitSlop.sm}
        onPress={onToggle}
        style={styles.header}
        testID={`issue-group-${group.status}-toggle`}
      >
        <Caret size={IconSize.xs} color={theme.colors.textTertiary} weight="bold" />
        <IssueStatusIcon status={group.status} />
        <ThemedText variant="label" style={styles.label} numberOfLines={1}>
          {label}
        </ThemedText>
        <ThemedText variant="caption" color="textTertiary" style={styles.count}>
          {group.issues.length}
        </ThemedText>
      </PressableScale>
      {collapsed
        ? null
        : group.issues.map((issue, index) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              index={indexOffset + index}
              onPress={() => onOpen(issue)}
              onLongPress={onLongPress ? () => onLongPress(issue) : undefined}
            />
          ))}
    </View>
  );
};

export default IssueGroup;
