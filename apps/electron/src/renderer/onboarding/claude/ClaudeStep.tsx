import { ActionButton } from "../../components/ActionButton";
import { ONBOARDING_LABELS } from "../labels";
import { OnboardingFooter } from "../shared/OnboardingFooter";
import { StepHero } from "../shared/StepHero";
import { AccountGroup } from "./AccountGroup";
import { ClaudeNoticeBlock } from "./ClaudeNoticeBlock";
import { CLAUDE_LABELS } from "./labels";
import { useClaudeStep } from "./use-claude-step";

export default function ClaudeStep() {
  const step = useClaudeStep();
  return (
    <>
      <StepHero icon="agents" title={ONBOARDING_LABELS.titles.claude} description={CLAUDE_LABELS.description} />
      <ClaudeNoticeBlock
        notice={step.view.notice}
        failed={step.failed}
        onCheck={step.recheck}
        onOpenGuide={step.openGuide}
      />
      <AccountGroup
        account={step.view.account}
        more={step.view.more}
        loading={step.loading}
        checking={step.checking}
        onCheck={step.recheck}
      />
      <OnboardingFooter
        start={<ActionButton variant="flat" size="dialog" label={ONBOARDING_LABELS.buttons.back} onClick={step.back} />}
        end={
          <ActionButton
            variant="primary"
            size="dialog"
            label={ONBOARDING_LABELS.buttons.continue}
            onClick={step.next}
            data-dialog-default=""
          />
        }
      />
    </>
  );
}
