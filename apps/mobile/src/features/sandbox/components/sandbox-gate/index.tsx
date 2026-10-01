import EmptyState from "@/components/empty-state";
import ScreenScaffold from "@/components/screen-scaffold";

const SandboxGate = () => (
  <ScreenScaffold>
    <EmptyState loading title="Loading sandboxes…" />
  </ScreenScaffold>
);

export default SandboxGate;
