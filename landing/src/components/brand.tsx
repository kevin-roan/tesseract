import { site } from "@/content/site";

import styles from "./brand.module.css";

export default function Brand() {
  return (
    <a href="#top" className={styles.root} aria-label={site.name}>
      <svg viewBox="0 0 12 20" className={styles.mark} aria-hidden>
        <path d="M6 0 0 3.6V20h6z" fill="#e6e6e6" />
        <path d="M6 0l6 3.6V20H6z" fill="#5c5c60" />
      </svg>
      <span>{site.name}</span>
    </a>
  );
}
