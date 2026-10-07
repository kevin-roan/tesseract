import type { CSSProperties } from "react";
import { Icon } from "../../../components/Icon";
import { cx } from "../../../lib/cx";
import { GLYPH_SIZE } from "./constants";
import { logoUrl } from "./logos";
import styles from "./shared.module.css";

export interface ProjectLogoProps {
  slug: string | null;
  className?: string;
}

export function ProjectLogo({ slug, className }: ProjectLogoProps) {
  const url = logoUrl(slug);
  if (!url) return <Icon name="project" size={GLYPH_SIZE} className={cx(styles.logoIcon, className)} />;
  const style = { "--logo-url": `url("${url}")` } as CSSProperties;
  return <span className={cx(styles.logo, className)} style={style} aria-hidden />;
}
