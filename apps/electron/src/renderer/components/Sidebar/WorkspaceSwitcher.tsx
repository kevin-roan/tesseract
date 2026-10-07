import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import { BrandMark } from "../BrandMark";
import { Icon } from "../Icon";
import { SIDEBAR } from "./constants";
import { SIDEBAR_LABELS } from "./labels";
import styles from "./Sidebar.module.css";

export interface WorkspaceSwitcherProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  name?: string;
  open?: boolean;
  tooltip?: string;
}

export const WorkspaceSwitcher = forwardRef<HTMLButtonElement, WorkspaceSwitcherProps>(function WorkspaceSwitcher(
  { name = SIDEBAR_LABELS.appName, open = false, tooltip = SIDEBAR_LABELS.mainMenu, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={cx(styles.switcher, open && styles.switcherOpen, className)}
      title={tooltip}
      aria-label={tooltip}
      aria-haspopup="menu"
      aria-expanded={open}
    >
      <BrandMark size={SIDEBAR.logoSize} className={styles.brandLogo} />
      <span className={styles.brandName}>{name}</span>
      <span className={styles.switcherCaret}>
        <Icon name="caret-down" size={SIDEBAR.caretSize} />
      </span>
    </button>
  );
});
