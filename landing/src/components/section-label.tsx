import Icon from "./icon";
import styles from "./section-label.module.css";

export default function SectionLabel({ index, label, href }: { index?: string; label: string; href?: string }) {
  return (
    <a className={styles.root} href={href}>
      {index ? <span className={styles.index}>{index}</span> : null}
      <span>{label}</span>
      <Icon name="chevron" size={12} strokeWidth={2} className={styles.chevron} />
    </a>
  );
}
