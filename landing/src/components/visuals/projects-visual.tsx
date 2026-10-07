"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

import { build, buildStages, shots } from "@/content/site";
import { ease } from "@/lib/motion";

import Device from "../device";
import Icon from "../icon";
import Panel from "../panel";
import StatusGlyph, { type GlyphState } from "../status-glyph";
import UiCard from "../ui-card";
import styles from "./visuals.module.css";

export default function ProjectsVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const phoneY = useTransform(scrollYProgress, [0, 1], [100, -60]);

  return (
    <Panel>
      <div ref={ref} className={`${styles.split} ${styles.reverse}`}>
        <div className={styles.phoneCol}>
          <motion.div className={styles.phoneSolo} style={{ y: phoneY }}>
            <Device shot={shots.projects} width="100%" />
          </motion.div>
        </div>
        <div className={styles.cardCol}>
          <UiCard title={`${build.project} · ${build.target}`} meta={build.id}>
            <ul className={styles.rows}>
              {buildStages.map((stage) => (
                <li key={stage.label} className={styles.row}>
                  <StatusGlyph state={stage.state as GlyphState} />
                  <strong className={stage.state === "queued" ? styles.dim : undefined}>{stage.label}</strong>
                  <span className={styles.time}>{stage.time}</span>
                </li>
              ))}
            </ul>
            <div className={styles.progress}>
              <span className={styles.track}>
                <motion.span
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: build.progress / 100 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ duration: 2.2, delay: 0.3, ease }}
                />
              </span>
              <code>{build.progress}%</code>
            </div>
            <div className={styles.artifact}>
              <Icon name="package" size={16} />
              <div>
                <strong>{build.artifact}</strong>
                <code>{build.sha}</code>
              </div>
              <span className={styles.download}>
                <Icon name="download" size={14} />
              </span>
            </div>
          </UiCard>
        </div>
      </div>
    </Panel>
  );
}
