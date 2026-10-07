"use client";

import { motion } from "motion/react";

import { hero } from "@/content/site";
import { appear } from "@/lib/motion";

import Button from "./button";
import Icon from "./icon";
import SplitHeading from "./split-heading";
import Stage from "./stage";
import styles from "./hero.module.css";

export default function Hero() {
  return (
    <section id="top" className={styles.root}>
      <div className={`container ${styles.copy}`}>
        <motion.a href={hero.announcement.href} className={styles.announcement} {...appear(0.1)}>
          <span className={styles.tag}>{hero.announcement.tag}</span>
          {hero.announcement.label}
          <Icon name="chevron" size={12} strokeWidth={2} />
        </motion.a>
        <SplitHeading lines={hero.title} className={styles.title} delay={0.2} />
        <motion.p className={styles.lead} {...appear(0.6)}>
          {hero.lead}
        </motion.p>
        <motion.div className={styles.actions} {...appear(0.75)}>
          <Button href={hero.primary.href} icon="apple">
            {hero.primary.label}
          </Button>
          <Button href={hero.secondary.href} variant="link" trailing="chevron">
            {hero.secondary.label}
          </Button>
        </motion.div>
      </div>
      <Stage />
    </section>
  );
}
