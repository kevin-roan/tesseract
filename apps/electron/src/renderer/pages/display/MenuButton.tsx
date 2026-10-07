import { useRef, useState, type AriaRole, type ReactNode } from "react";
import { Floating, rectAnchor, type AnchorRect } from "../../components/ActionMenu";
import { IconButton } from "../../components/IconButton";
import type { IconName } from "../../theme/icons";

export interface MenuButtonProps {
  icon: IconName;
  label: string;
  disabled?: boolean;
  open: boolean;
  onOpenChange(open: boolean): void;
  children: ReactNode;
  role?: AriaRole;
  minWidth?: number;
  panelClassName?: string;
  className?: string;
}

export function MenuButton({ icon, label, disabled = false, open, onOpenChange, children, role = "menu", minWidth, panelClassName, className }: MenuButtonProps) {
  const wrapper = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const toggle = () => {
    if (open) {
      onOpenChange(false);
      return;
    }
    const rect = wrapper.current?.getBoundingClientRect();
    if (rect) setAnchor(rectAnchor(rect));
    onOpenChange(true);
  };
  return (
    <span ref={wrapper}>
      <IconButton icon={icon} label={label} className={className} checked={open} disabled={disabled} aria-haspopup={role === "menu" ? "menu" : "dialog"} aria-expanded={open} onClick={toggle} />
      <Floating
        open={open && !disabled}
        anchor={anchor}
        onClose={() => onOpenChange(false)}
        ignoreRef={wrapper}
        role={role}
        ariaLabel={label}
        minWidth={minWidth}
        className={panelClassName}
      >
        {children}
      </Floating>
    </span>
  );
}
