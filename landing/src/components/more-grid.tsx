import { more } from "@/content/site";

import Icon from "./icon";
import Reveal from "./reveal";
import styles from "./more-grid.module.css";

export default function MoreGrid() {
  return (
    <section className={styles.root}>
      <div className="container">
        <Reveal className={styles.head}>
          <h2>And everything else a development machine needs</h2>
        </Reveal>
        <div className={styles.grid}>
          {more.map((item, i) => (
            <Reveal key={item.title} delay={(i % 3) * 0.06} className={styles.cell}>
              <Icon name={item.icon} size={18} className={styles.icon} />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
