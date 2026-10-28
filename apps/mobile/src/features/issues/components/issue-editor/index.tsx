import { useMemo } from "react";
import { TextInput, View } from "react-native";
import { CheckIcon } from "phosphor-react-native";
import { LIMITS, type Issue } from "@tesseract/protocol";

import ActionButton from "@/components/action-button";
import Markdown from "@/components/markdown";
import PressableScale from "@/components/pressable-scale";
import TextField from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { useDraftText } from "../../hooks/use-draft-text";
import { ISSUE_DETAIL_COPY, ISSUE_STATUS_LABELS } from "../../utils/content";
import IssueStatusIcon from "../issue-status-icon";
import createStyles from "./styles";

type DraftText = ReturnType<typeof useDraftText>;

export type IssueEditorProps = {
  issue: Issue;
  identifier: string;
  title: DraftText;
  description: DraftText;
};

const IssueEditor = ({ issue, identifier, title, description }: IssueEditorProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.editor}>
      <View style={styles.meta}>
        <IssueStatusIcon status={issue.status} />
        <ThemedText variant="caption" color="textSecondary">
          {`${identifier} · ${ISSUE_STATUS_LABELS[issue.status]}`}
        </ThemedText>
      </View>
      <TextInput
        value={title.value}
        onChangeText={title.setValue}
        onFocus={title.begin}
        onBlur={title.commit}
        submitBehavior="blurAndSubmit"
        multiline
        maxLength={LIMITS.maxIssueTitleLength}
        accessibilityLabel={ISSUE_DETAIL_COPY.titleLabel}
        placeholderTextColor={theme.colors.textTertiary}
        selectionColor={theme.colors.focusRing}
        keyboardAppearance={theme.keyboardAppearance}
        returnKeyType="done"
        style={styles.title}
        testID="issue-title"
      />
      {description.editing ? (
        <View style={styles.description}>
          <TextField
            label={ISSUE_DETAIL_COPY.descriptionLabel}
            value={description.value}
            onChangeText={description.setValue}
            placeholder={ISSUE_DETAIL_COPY.descriptionPlaceholder}
            maxLength={LIMITS.maxIssueDescriptionLength}
            autoCapitalize="sentences"
            autoCorrect
            autoFocus
            multiline
            testID="issue-description-input"
          />
          <View style={styles.actions}>
            <ActionButton label={ISSUE_DETAIL_COPY.cancel} variant="secondary" size="sm" onPress={description.cancel} testID="issue-description-cancel" />
            <ActionButton
              label={ISSUE_DETAIL_COPY.save}
              icon={CheckIcon}
              size="sm"
              onPress={description.commit}
              accessibilityLabel={ISSUE_DETAIL_COPY.saveDescription}
              testID="issue-description-save"
            />
          </View>
        </View>
      ) : (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${ISSUE_DETAIL_COPY.edit} ${ISSUE_DETAIL_COPY.descriptionLabel}`}
          onPress={description.begin}
          style={styles.descriptionBody}
          testID="issue-description"
        >
          {issue.description.trim() ? (
            <Markdown>{issue.description}</Markdown>
          ) : (
            <ThemedText variant="body" color="textTertiary">
              {ISSUE_DETAIL_COPY.descriptionPlaceholder}
            </ThemedText>
          )}
        </PressableScale>
      )}
    </View>
  );
};

export default IssueEditor;
