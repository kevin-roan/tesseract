import { Fragment, useMemo, type RefObject } from "react";
import { Floating } from "./Floating";
import { MenuItem, MenuSeparator } from "./MenuPanel";
import { hasMenuEntries, nonEmptySections, type AnchorRect, type MenuSections } from "./model";

export interface ActionMenuProps {
  anchor: AnchorRect | null;
  sections: MenuSections;
  onClose(): void;
  ariaLabel?: string;
  ignoreRef?: RefObject<HTMLElement | null>;
}

export function ActionMenu({ anchor, sections, onClose, ariaLabel, ignoreRef }: ActionMenuProps) {
  const visible = useMemo(() => nonEmptySections(sections), [sections]);
  return (
    <Floating open={anchor !== null && hasMenuEntries(visible)} anchor={anchor} onClose={onClose} ariaLabel={ariaLabel} ignoreRef={ignoreRef}>
      {visible.map((section, sectionIndex) => (
        <Fragment key={sectionIndex}>
          {sectionIndex > 0 ? <MenuSeparator /> : null}
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
