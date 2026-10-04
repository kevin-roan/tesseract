import { SparkleIcon } from "phosphor-react-native";

import { ListGroup, ListRow } from "@/components/list-group";
import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";
import OptionSheet from "@/components/option-sheet";
import Section from "@/components/section";

import type { ProjectClaudeAccountState } from "../../hooks/use-project-claude-account";
import { CLAUDE_ACCOUNTS_COPY } from "../../utils/accounts";

export type ProjectClaudeAccountProps = {
  state: ProjectClaudeAccountState;
};

const ProjectClaudeAccount = ({ state }: ProjectClaudeAccountProps) => (
  <Section title={CLAUDE_ACCOUNTS_COPY.projectSection} testID="project-claude-account">
    {state.error ? (
      <MotionItem>
        <Notice tone="danger" message={state.error} />
      </MotionItem>
    ) : null}
    <ListGroup>
      <ListRow
        icon={SparkleIcon}
        label={CLAUDE_ACCOUNTS_COPY.projectRow}
        detail={state.summary}
        value={state.saving ? CLAUDE_ACCOUNTS_COPY.saving : undefined}
        chevron={state.canChoose}
        onPress={state.canChoose ? state.open : undefined}
        testID="project-claude-account-row"
      />
    </ListGroup>
    <OptionSheet
      visible={state.sheetOpen}
      title={CLAUDE_ACCOUNTS_COPY.projectRow}
      footnote={CLAUDE_ACCOUNTS_COPY.projectSheetFootnote}
      options={state.options}
      selectedId={state.selectedId}
      onSelect={state.select}
      onClose={state.close}
    />
  </Section>
);

export default ProjectClaudeAccount;
