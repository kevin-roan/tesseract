import "@xterm/xterm/css/xterm.css";
import type { MouseEvent } from "react";
import { useTerminalView } from "../../features/terminals/hooks/use-terminal-view";
import styles from "./TerminalView.module.css";

export interface TerminalViewProps {
  id: string;
  visible: boolean;
  background: string;
  onContextMenu(event: MouseEvent<HTMLDivElement>): void;
}

export function TerminalView({ id, visible, background, onContextMenu }: TerminalViewProps) {
  const ref = useTerminalView(id, visible);
  return (
    <div className={styles.view} data-visible={visible || undefined} aria-hidden={!visible || undefined} style={{ background }} onContextMenu={onContextMenu}>
      <div ref={ref} className={styles.host} data-terminal-id={id} />
    </div>
  );
}
