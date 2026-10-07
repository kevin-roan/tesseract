import type { ReactNode } from "react";

import Icon, { type IconName } from "./icon";
import styles from "./button.module.css";

type ButtonProps = {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "link";
  size?: "sm" | "md";
  icon?: IconName;
  trailing?: IconName;
};

export default function Button({ href, children, variant = "primary", size = "md", icon, trailing }: ButtonProps) {
  const className = `${styles.button} ${styles[variant]} ${styles[size]}`;
  const content = (
    <>
      {icon ? <Icon name={icon} size={16} /> : null}
      <span>{children}</span>
      {trailing ? <Icon name={trailing} size={14} strokeWidth={2} className={styles.trailing} /> : null}
    </>
  );
  if (!href) return <span className={`${className} ${styles.disabled}`}>{content}</span>;
  return (
    <a className={className} href={href}>
      {content}
    </a>
  );
}
