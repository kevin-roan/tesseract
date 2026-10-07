import type { ReactNode } from "react";

import type { Section } from "@/content/site";

import Icon from "./icon";
import Reveal from "./reveal";
import SectionLabel from "./section-label";
import styles from "./feature-section.module.css";

export default function FeatureSection({ section, children }: { section: Section; children: ReactNode }) {
  return (
    <section id={section.id} className={styles.root}>
      <div className="container">
        <Reveal className={styles.header}>
          <div className={styles.headline}>
            <SectionLabel index={section.index} label={section.label} href={`#${section.id}`} />
            <h2>{section.title}</h2>
          </div>
          <p className={styles.body}>{section.body}</p>
        </Reveal>
        <Reveal className={styles.visual} amount={0.15}>
          {children}
        </Reveal>
        <ul className={styles.points}>
          {section.points.map((point, i) => (
            <li key={point.title}>
              <Reveal delay={i * 0.08}>
                <span className={styles.figure}>
                  FIG {section.index.replace(".0", "")}.{i + 1}
                </span>
                <Icon name={point.icon} size={18} className={styles.icon} />
                <h3>{point.title}</h3>
                <p>{point.body}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
