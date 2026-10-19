import { LAUNCHERS, SANDBOX_PLACEHOLDER } from "../../features/terminals/constants";
import { useTerminalsPage } from "../../features/terminals/hooks/use-terminals-page";
import { TerminalsLayout } from "./TerminalsLayout";

export default function TerminalsPage() {
  const page = useTerminalsPage();
  return (
    <TerminalsLayout
      page={page}
      empty={page.empty}
      onEmptyAction={page.onEmptyAction}
      launchers={LAUNCHERS}
      placeholder={SANDBOX_PLACEHOLDER}
      projects={page.projects}
    />
  );
}
