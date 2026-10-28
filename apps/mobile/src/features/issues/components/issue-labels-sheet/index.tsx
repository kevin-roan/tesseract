import { CheckIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import BottomSheet from "@/components/bottom-sheet";
import TextField from "@/components/text-field";

import type { IssueLabelsState } from "../../hooks/use-issue-labels";
import { ISSUE_DETAIL_COPY } from "../../utils/content";

export type IssueLabelsSheetProps = {
  state: IssueLabelsState;
};

const IssueLabelsSheet = ({ state }: IssueLabelsSheetProps) => (
  <BottomSheet visible={state.visible} onClose={state.close} title={ISSUE_DETAIL_COPY.labelsSheet} avoidKeyboard testID="issue-labels-sheet">
    <TextField
      label={ISSUE_DETAIL_COPY.labelsField}
      hint={ISSUE_DETAIL_COPY.labelsHint}
      value={state.text}
      onChangeText={state.setText}
      autoFocus
      returnKeyType="done"
      onSubmitEditing={state.submit}
      testID="issue-labels-input"
    />
    <ActionButton label={ISSUE_DETAIL_COPY.save} icon={CheckIcon} onPress={state.submit} stretch testID="issue-labels-save" />
  </BottomSheet>
);

export default IssueLabelsSheet;
