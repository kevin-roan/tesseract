"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

import { agentSteps, shots } from "@/content/site";
import { ease } from "@/lib/motion";

import Device from "../device";
import Panel from "../panel";
import StatusGlyph, { type GlyphState } from "../status-glyph";
import UiCard from "../ui-card";
import styles from "./visuals.module.css";

export default function AgentsVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const back = useTransform(scrollYProgress, [0, 1], [60, -40]);
  const front = useTransform(scrollYProgress, [0, 1], [110, -60]);

  return (
    <Panel>
      <div ref={ref} className={styles.split}>
        <div className={styles.cardCol}>
          <UiCard title="Fix login crash" meta="Opus · expensifo">
            <div className={styles.prompt}>
              The app crashes after login on Android. Find it, fix it and build a release APK.
            </div>
            <motion.ul
              className={styles.rows}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.6 }}
              variants={{ visible: { transition: { staggerChildren: 0.45, delayChildren: 0.3 } } }}
            >
              {agentSteps.map((step) => (
                <motion.li
                  key={step.label}
                  className={styles.row}
                  variants={{ hidden: { opacity: 0, y: 8, filter: "blur(4px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)" } }}
                  transition={{ duration: 0.6, ease }}
                >
                  <StatusGlyph state={step.state as GlyphState} />
                  <strong>{step.label}</strong>
                  <code>{step.detail}</code>
                  {step.result ? <span className={step.state === "done" ? styles.ok : styles.pending}>{step.result}</span> : null}
                </motion.li>
              ))}
            </motion.ul>
          </UiCard>
        </div>
        <div className={styles.phoneCol}>
          <motion.div className={styles.phoneBack} style={{ y: back }}>
            <Device shot={shots.runLight} width="100%" />
          </motion.div>
          <motion.div className={styles.phoneFront} style={{ y: front }}>
            <Device shot={shots.runDark} width="100%" />
          </motion.div>
        </div>
      </div>
    </Panel>
  );
}
