import { useActionMenu } from "../../components/ActionMenu";
import { useMachineMenuSections } from "../../features/machines";

export function useAccountMenu() {
  const menu = useActionMenu();
  const sections = useMachineMenuSections();
  return { ...menu, sections };
}
