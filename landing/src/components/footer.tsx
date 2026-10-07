import { footer, site } from "@/content/site";

import Brand from "./brand";
import styles from "./footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.root}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Brand />
          <span>
            © {new Date().getFullYear()} {site.name}
          </span>
        </div>
        {footer.columns.map((column) => (
          <nav key={column.title} className={styles.column} aria-label={column.title}>
            <h4>{column.title}</h4>
            {column.links.map((link) => (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        ))}
      </div>
      <div className={`container ${styles.note}`}>{footer.note}</div>
    </footer>
  );
}
