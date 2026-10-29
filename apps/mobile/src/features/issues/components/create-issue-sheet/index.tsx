import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { PlusIcon } from "phosphor-react-native";
import { LIMITS } from "@tesseract/protocol";

import ActionButton from "@/components/action-button";
import BottomSheet from "@/components/bottom-sheet";
import { ListGroup, ListSwitchRow } from "@/components/list-group";
import Notice from "@/components/notice";
import SegmentedPills from "@/components/segmented-pills";
import TextField from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { IssueFormState } from "../../hooks/use-issue-form";
import { ISSUE_FORM_COPY } from "../../utils/content";
import { HUMAN_ASSIGNEE_SEGMENTS, PRIORITY_SEGMENTS, STATUS_SEGMENTS } from "../../utils/options";
import createStyles from "./styles";

export type CreateIssueSheetProps = {
  state: IssueFormState;
  testID?: string;
};

const CreateIssueSheet = ({ state, testID = "create-issue" }: CreateIssueSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <BottomSheet visible={state.visible} onClose={state.close} title={ISSUE_FORM_COPY.title} avoidKeyboard testID={`${testID}-sheet`}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state.projects.length > 0 ? (
          <View style={styles.field} testID={`${testID}-project`}>
            <ThemedText variant="caption" color="textSecondary">
              {ISSUE_FORM_COPY.project}
            </ThemedText>
            <SegmentedPills
              options={state.projects}
              value={state.project ?? ""}
              onChange={state.setProject}
              scrollable
              label={ISSUE_FORM_COPY.project}
            />
          </View>
        ) : null}
        <TextField
          label={ISSUE_FORM_COPY.titleLabel}
          placeholder={ISSUE_FORM_COPY.titlePlaceholder}
          value={state.title}
          onChangeText={state.setTitle}
          maxLength={LIMITS.maxIssueTitleLength}
          autoCapitalize="sentences"
          autoCorrect
          autoFocus
          returnKeyType="next"
          editable={!state.saving}
          testID={`${testID}-title`}
        />
        <TextField
          label={ISSUE_FORM_COPY.descriptionLabel}
          placeholder={ISSUE_FORM_COPY.descriptionPlaceholder}
          value={state.description}
          onChangeText={state.setDescription}
          maxLength={LIMITS.maxIssueDescriptionLength}
          autoCapitalize="sentences"
          autoCorrect
          multiline
          editable={!state.saving}
          testID={`${testID}-description`}
        />
        <View style={styles.field} testID={`${testID}-status`}>
          <ThemedText variant="caption" color="textSecondary">
            {ISSUE_FORM_COPY.status}
          </ThemedText>
          <SegmentedPills options={STATUS_SEGMENTS} value={state.status} onChange={state.setStatus} scrollable label={ISSUE_FORM_COPY.status} />
        </View>
        <View style={styles.field} testID={`${testID}-priority`}>
          <ThemedText variant="caption" color="textSecondary">
            {ISSUE_FORM_COPY.priority}
          </ThemedText>
          <SegmentedPills
            options={PRIORITY_SEGMENTS}
            value={state.priority}
            onChange={state.setPriority}
            scrollable
            label={ISSUE_FORM_COPY.priority}
          />
        </View>
        <ListGroup>
          <ListSwitchRow
            label={ISSUE_FORM_COPY.assignClaude}
            detail={state.claudeHint}
            value={state.claude}
            onValueChange={state.setClaude}
            disabled={state.saving}
            testID={`${testID}-claude`}
          />
        </ListGroup>
        {state.claude ? null : (
          <View style={styles.field} testID={`${testID}-assignee`}>
            <ThemedText variant="caption" color="textSecondary">
              {ISSUE_FORM_COPY.assignee}
            </ThemedText>
            <SegmentedPills options={HUMAN_ASSIGNEE_SEGMENTS} value={state.human} onChange={state.setHuman} label={ISSUE_FORM_COPY.assignee} />
          </View>
        )}
        {state.error ? <Notice tone="danger" message={state.error} /> : null}
        <ActionButton
          label={ISSUE_FORM_COPY.create}
          icon={PlusIcon}
          onPress={state.submit}
          loading={state.saving}
          stretch
          testID={`${testID}-submit`}
        />
      </ScrollView>
    </BottomSheet>
  );
};

export default CreateIssueSheet;
