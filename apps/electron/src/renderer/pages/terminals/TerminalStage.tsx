import type { Ref } from "react";
import { ActionMenu, type MenuSections } from "../../components/ActionMenu";
import { EmptyState } from "../../components/EmptyState";
import { useTerminalContextMenu } from "../../features/terminals/hooks/use-terminal-context-menu";
import { MENU_LABELS, PLACEHOLDER_LABELS } from "../../features/terminals/labels";
import type { BannerAction, BannerModel } from "../../features/terminals/types";
import { SessionBanner } from "./SessionBanner";
import { TerminalView } from "./TerminalView";
import styles from "./TerminalStage.module.css";

export interface TerminalStageProps {
  stageRef: Ref<HTMLDivElement>;
  attached: readonly string[];
  selectedId: string | null;
  background: string;
  banner: BannerModel | null;
  creating: boolean;
  contextMenu: MenuSections;
  onBannerAction(action: BannerAction): void;
  onNewShell(): void;
  onNewClaude(): void;
}

export function TerminalStage({
  stageRef,
  attached,
  selectedId,
  background,
  banner,
  creating,
  contextMenu,
  onBannerAction,
  onNewShell,
  onNewClaude,
}: TerminalStageProps) {
  const menu = useTerminalContextMenu();
  const showPlaceholder = selectedId === null || !attached.includes(selectedId);
  return (
    <div ref={stageRef} className={styles.stage}>
      <div className={styles.views}>
        {attached.map((id) => (
          <TerminalView
            key={id}
            id={id}
            visible={id === selectedId}
            background={background}
            onContextMenu={(event) => menu.onContextMenu(id, event)}
          />
        ))}
        {showPlaceholder ? (
          <div className={styles.placeholder} data-disabled={creating || undefined} inert={creating || undefined}>
            <EmptyState
              icon="terminal"
              title={PLACEHOLDER_LABELS.title}
              message={PLACEHOLDER_LABELS.message}
              actionLabel={PLACEHOLDER_LABELS.shell}
              onAction={onNewShell}
              secondaryLabel={PLACEHOLDER_LABELS.claude}
              onSecondary={onNewClaude}
            />
          </div>
        ) : null}
      </div>
      <SessionBanner banner={showPlaceholder ? null : banner} bannerKey={selectedId ?? ""} onAction={onBannerAction} />
      <ActionMenu anchor={menu.anchor} sections={contextMenu} onClose={menu.close} ariaLabel={MENU_LABELS.terminalMenu} />
    </div>
  );
}
