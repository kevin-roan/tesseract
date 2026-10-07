import { cta, downloads } from "@/content/site";

import Button from "./button";
import Icon from "./icon";
import Reveal from "./reveal";
import styles from "./download.module.css";

export default function Download() {
  return (
    <section id="download" className={styles.root}>
      <div className={styles.glow} />
      <div className="container">
        <Reveal className={styles.head}>
          <h2>
            {cta.title.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          <div className={styles.actions}>
            <Button href={downloads[0].href} icon="apple">
              Download for iPhone
            </Button>
            <Button href={downloads[1].href} variant="secondary" icon="play">
              Get it on Google Play
            </Button>
          </div>
        </Reveal>
        <Reveal className={styles.grid} delay={0.1}>
          {downloads.map((d) => {
            const available = Boolean(d.href);
            const Tag = available ? "a" : "div";
            return (
              <Tag key={d.id} className={`${styles.tile} ${available ? "" : styles.soon}`} {...(available ? { href: d.href } : {})}>
                <Icon name={d.icon} size={20} className={styles.icon} />
                <span className={styles.label}>{d.label}</span>
                <span className={styles.detail}>{available ? d.detail : cta.soon}</span>
                <Icon name={available ? "arrow" : "lock"} size={14} className={styles.arrow} />
              </Tag>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
