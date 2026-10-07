import { useLocation } from "react-router";
import { isPageId } from "../../shared/routes";
import { pageKeyOf } from "../app/feedback";
import { useNavigateTo } from "../app/navigation";
import { findPage } from "../app/registry/pages";
import { PageHeader } from "../components/PageHeader";
import { useHeaderStore } from "./header-store";
import { SHELL_LABELS } from "./labels";

export interface ShellPageHeaderProps {
  onBack?: () => void;
  backdrop?: boolean;
  trafficLightInset?: boolean;
}

export function ShellPageHeader({ onBack, backdrop, trafficLightInset }: ShellPageHeaderProps) {
  const pageId = pageKeyOf(useLocation().pathname);
  const page = findPage(pageId);
  const header = useHeaderStore();
  const navigateTo = useNavigateTo();
  return (
    <PageHeader
      title={header.title ?? page?.title ?? ""}
      parent={header.parent}
      onParentClick={header.parent && isPageId(pageId) ? () => navigateTo(pageId) : undefined}
      actions={header.actions}
      onBack={onBack ?? header.onBack ?? undefined}
      backLabel={SHELL_LABELS.back}
      backdrop={backdrop}
      trafficLightInset={trafficLightInset}
    />
  );
}
