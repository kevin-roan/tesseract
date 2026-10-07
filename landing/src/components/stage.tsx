"use client";

import { useRef, type CSSProperties } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";

import { shots } from "@/content/site";
import { easeOut } from "@/lib/motion";

import Device from "./device";
import styles from "./stage.module.css";

const layout = [
  { shot: shots.inboxLight, x: -440, y: 150, w: 250, depth: 2, delay: 1.25, className: "far" },
  { shot: shots.runDark, x: -240, y: 70, w: 290, depth: 1, delay: 1.1, className: "near" },
  { shot: shots.projects, x: 240, y: 70, w: 290, depth: 1, delay: 1.15, className: "near" },
  { shot: shots.runLight, x: 440, y: 150, w: 250, depth: 2, delay: 1.3, className: "far" },
  { shot: shots.inboxDark, x: 0, y: 0, w: 340, depth: 0, delay: 0.95, className: "front" },
] as const;

export default function Stage() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.4 });
  const rotateX = useTransform(progress, [0.25, 0.6], [22, 0]);
  const scale = useTransform(progress, [0.25, 0.6], [0.94, 1]);
  const near = useTransform(progress, [0.3, 1], [0, -60]);
  const far = useTransform(progress, [0.3, 1], [0, -130]);
  const spread = useTransform(progress, [0.3, 0.7], [0.92, 1]);

  return (
    <div ref={ref} className={styles.root}>
      <div className={styles.glow} />
      <div className={styles.floor} />
      <motion.div className={styles.plane} style={{ rotateX, scale }}>
        {layout.map((item) => (
          <motion.div
            key={item.shot.src}
            className={`${styles.slot} ${styles[item.className]}`}
            style={{ "--x": item.x, "--w": item.w, "--y": item.y } as CSSProperties}
            initial={{ opacity: 0, y: 140 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.6, delay: item.delay, ease: easeOut }}
          >
            <motion.div style={{ y: item.depth === 0 ? 0 : item.depth === 1 ? near : far, scale: item.depth === 0 ? 1 : spread }}>
              <Device shot={item.shot} width="100%" priority={item.depth === 0} />
            </motion.div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
