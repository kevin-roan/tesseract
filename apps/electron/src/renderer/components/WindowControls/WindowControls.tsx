import type { MouseEvent } from "react";
import { currentPlatform } from "../../app/runtime";
import { cx } from "../../lib/cx";
import { Glyph } from "./Glyph";
import type { GlyphName } from "./geometry";
import { WINDOW_CONTROLS_LABELS } from "./labels";
import { useWindowControls } from "./use-window-controls";
import styles from "./WindowControls.module.css";

export interface WindowControlsViewProps {
  maximized?: boolean;
  backdrop?: boolean;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  onClose?: () => void;
  className?: string;
}

const keepFocus = (event: MouseEvent) => event.preventDefault();

function ControlButton({ glyph, label, onClick, danger = false }: { glyph: GlyphName; label: string; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      className={cx(styles.button, danger && styles.close)}
      title={label}
      aria-label={label}
      onMouseDown={keepFocus}
      onClick={onClick}
    >
      <Glyph name={glyph} />
    </button>
  );
}

export function WindowControlsView({ maximized = false, backdrop = false, onMinimize, onToggleMaximize, onClose, className }: WindowControlsViewProps) {
  return (
    <div
      className={cx(styles.controls, "to-no-drag", className)}
      role="group"
      aria-label={WINDOW_CONTROLS_LABELS.group}
      data-backdrop={backdrop || undefined}
    >
      <ControlButton glyph="minimize" label={WINDOW_CONTROLS_LABELS.minimize} onClick={onMinimize} />
      <ControlButton
        glyph={maximized ? "restore" : "maximize"}
        label={maximized ? WINDOW_CONTROLS_LABELS.restore : WINDOW_CONTROLS_LABELS.maximize}
        onClick={onToggleMaximize}
      />
      <ControlButton glyph="close" label={WINDOW_CONTROLS_LABELS.close} onClick={onClose} danger />
    </div>
  );
}

export interface WindowControlsProps {
  className?: string;
}

export function WindowControls({ className }: WindowControlsProps) {
  const controls = useWindowControls();
  if (currentPlatform() === "darwin") return null;
  return (
    <WindowControlsView
      className={className}
      maximized={controls.maximized}
      backdrop={!controls.focused}
      onMinimize={controls.minimize}
      onToggleMaximize={controls.toggleMaximize}
      onClose={controls.close}
    />
  );
}
