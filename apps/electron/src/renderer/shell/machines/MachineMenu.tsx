import { Fragment, type RefObject } from "react";
import { Floating, MenuItem, MenuSeparator, nonEmptySections, type AnchorRect, type MenuSections } from "../../components/ActionMenu";
import type { MachineRow } from "../../features/machines";
import { MachineMenuItem } from "./MachineMenuItem";
import styles from "./MachineMenu.module.css";

export interface MachineMenuProps {
  anchor: AnchorRect | null;
  machines: readonly MachineRow[];
  sections: MenuSections;
  onSwitch(id: string): void;
  onClose(): void;
  ariaLabel?: string;
  ignoreRef?: RefObject<HTMLElement | null>;
}

export function MachineMenu({ anchor, machines, sections, onSwitch, onClose, ariaLabel, ignoreRef }: MachineMenuProps) {
  const visible = nonEmptySections(sections);
  return (
    <Floating open={anchor !== null} anchor={anchor} onClose={onClose} ariaLabel={ariaLabel} ignoreRef={ignoreRef} className={styles.menu}>
      {machines.map((machine) => (
        <MachineMenuItem
          key={machine.id}
          machine={machine}
          onSelect={() => {
            onClose();
            onSwitch(machine.id);
          }}
        />
      ))}
      {visible.map((section, sectionIndex) => (
        <Fragment key={sectionIndex}>
          {machines.length > 0 || sectionIndex > 0 ? <MenuSeparator /> : null}
          {section.map((entry, entryIndex) => (
            <MenuItem
              key={entry.id ?? `${sectionIndex}-${entryIndex}`}
              label={entry.label}
              icon={entry.icon}
              danger={entry.danger}
              disabled={entry.disabled}
              onClick={() => {
                onClose();
                entry.onSelect();
              }}
            />
          ))}
        </Fragment>
      ))}
    </Floating>
  );
}
