import { statement } from "@/content/site";

import SectionLabel from "./section-label";
import WordReveal from "./word-reveal";
import styles from "./statement.module.css";

export default function Statement() {
  return (
    <section className={styles.root}>
      <div className="container">
        <div className={styles.label}>
          <SectionLabel label="Why Monolith" href="#agents" />
        </div>
        <WordReveal text={statement} />
      </div>
    </section>
  );
}
