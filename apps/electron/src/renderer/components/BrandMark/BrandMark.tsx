import { cx } from "../../lib/cx";
import appIcon from "./app-icon.png";
import styles from "./BrandMark.module.css";

export interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 20, className }: BrandMarkProps) {
  return <img className={cx(styles.mark, className)} src={appIcon} width={size} height={size} alt="" aria-hidden draggable={false} />;
}
