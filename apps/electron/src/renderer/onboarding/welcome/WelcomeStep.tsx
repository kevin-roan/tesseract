import { ActionButton } from "../../components/ActionButton";
import { Icon } from "../../components/Icon";
import { PreferenceRow, SettingsGroup } from "../../components/PreferenceRows";
import { OnboardingFooter } from "../shared/OnboardingFooter";
import { StepHero } from "../shared/StepHero";
import { CheckRow, useOnboardingNavigation, useOnboardingStateQuery, useStatusOverrides } from "../shell";
import { WHAT_HAPPENS_ROWS } from "./constants";
import { WELCOME_LABELS } from "./labels";
import { requirementChecks } from "./model";

export default function WelcomeStep() {
  const navigation = useOnboardingNavigation();
  const query = useOnboardingStateQuery();
  const setStatus = useStatusOverrides((store) => store.set);
  const checks = requirementChecks(query.data?.host ?? null, query.isError);
  const start = () => {
    setStatus("welcome", "done");
    navigation.next();
  };
  return (
    <>
      <StepHero icon="whats-new" title={WELCOME_LABELS.title} description={WELCOME_LABELS.description} />
      <SettingsGroup title={WELCOME_LABELS.whatHappens}>
        {WHAT_HAPPENS_ROWS.map((row) => (
          <PreferenceRow
            key={row.id}
            title={WELCOME_LABELS.rows[row.id].title}
            subtitle={WELCOME_LABELS.rows[row.id].subtitle}
            prefix={<Icon name={row.icon} color="text-secondary" />}
          />
        ))}
      </SettingsGroup>
      <SettingsGroup title={WELCOME_LABELS.requirements}>
        {checks.map((check, index) => (
          <CheckRow key={check.id} index={index} title={check.title} subtitle={check.subtitle} status={check.status} />
        ))}
      </SettingsGroup>
      <OnboardingFooter
        end={<ActionButton variant="primary" size="dialog" label={WELCOME_LABELS.getStarted} onClick={start} />}
      />
    </>
  );
}
