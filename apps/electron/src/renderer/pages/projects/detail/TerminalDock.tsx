import type { ReactNode } from "react";
import { IconButton } from "../../../components/IconButton";
import { Icon } from "../../../components/Icon";
import { ResizeHandle } from "../../../components/ResizeHandle";
import type { ProjectTerminalPanel } from "../../../features/terminals/hooks/use-project-terminal-panel";
import { PANEL_LABELS } from "../../../features/terminals/labels";
import { kindIcon } from "../../../features/terminals/model";
import { PANEL_SIZE, PROJECT_PANEL_PLACEHOLDER as PLACEHOLDER } from "../../../features/terminals/constants";
import { DeleteSessionDialog } from "../../terminals/DeleteSessionDialog";
import { TerminalStage } from "../../terminals/TerminalStage";
import styles from "./TerminalDock.module.css";

export interface TerminalDockProps {
  panel: ProjectTerminalPanel;
  children: ReactNode;
}

export function TerminalDock({ panel, children }: TerminalDockProps) {
  return (
    <div ref={panel.dockRef} className={styles.dock} data-placement={panel.placement}>
      <div className={styles.main}>{children}</div>
      {panel.open ? <TerminalPanel panel={panel} /> : null}
    </div>
  );
}

function TerminalPanel({ panel }: { panel: ProjectTerminalPanel }) {
  const right = panel.placement === "right";
  const { actions } = panel;
  return (
    <aside className={styles.panel} style={right ? { width: panel.size } : { height: panel.size }} aria-label={PANEL_LABELS.region}>
      <ResizeHandle
        width={panel.size}
        bounds={panel.bounds}
        defaultWidth={PANEL_SIZE[panel.placement].default}
        axis={right ? "x" : "y"}
        reverse
        label={PANEL_LABELS.resize}
        onResize={panel.setSize}
        onCommit={panel.setSize}
      />
      <header className={styles.bar}>
        <div className={styles.tabs} role="tablist" aria-label={PANEL_LABELS.tabs}>
          {panel.tabs.map((tab) => (
            <div key={tab.id} className={styles.tab} data-selected={tab.id === panel.activeId || undefined}>
              <button type="button" role="tab" aria-selected={tab.id === panel.activeId} className={styles.tabButton} onClick={() => actions.select(tab.id)}>
                <Icon name={kindIcon(tab.kind)} size={13} />
                <span className={styles.tabLabel}>{tab.label}</span>
              </button>
              <IconButton icon="close" label={PANEL_LABELS.closeTab(tab.label)} size={22} iconSize={12} onClick={() => actions.requestClose(tab.id)} />
            </div>
          ))}
        </div>
        <div className={styles.tools}>
          <IconButton icon="add" label={PANEL_LABELS.newShell} size={24} disabled={panel.creating} onClick={() => panel.launch("shell")} />
          <IconButton
            icon={right ? "panelBottom" : "panelRight"}
            label={right ? PANEL_LABELS.dockBottom : PANEL_LABELS.dockRight}
            size={24}
            onClick={() => panel.setPlacement(right ? "bottom" : "right")}
          />
          <IconButton icon="close" label={PANEL_LABELS.hide} size={24} onClick={panel.hide} />
        </div>
      </header>
      <TerminalStage
        stageRef={panel.stageRef}
        attached={panel.attached}
        selectedId={panel.activeId}
        background={panel.background}
        banner={panel.banner}
        creating={panel.creating}
        contextMenu={panel.contextMenu}
        placeholder={PLACEHOLDER}
        onBannerAction={panel.onBannerAction}
        onPrimary={() => panel.launch(PLACEHOLDER.primaryKind)}
        onSecondary={() => PLACEHOLDER.secondaryKind && panel.launch(PLACEHOLDER.secondaryKind)}
      />
      <DeleteSessionDialog target={panel.confirm} onConfirm={(id) => void actions.remove(id)} onClose={panel.cancelConfirm} />
    </aside>
  );
}
