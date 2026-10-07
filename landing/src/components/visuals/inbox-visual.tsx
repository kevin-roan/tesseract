"use client";

import { motion } from "motion/react";

import { build, notifications, shots } from "@/content/site";
import { ease } from "@/lib/motion";

import Device from "../device";
import Panel from "../panel";
import styles from "./visuals.module.css";

export default function InboxVisual() {
  return (
    <Panel>
      <div className={styles.inbox}>
        <motion.ul
          className={styles.banners}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={{ visible: { transition: { staggerChildren: 0.35, delayChildren: 0.2 } } }}
        >
          {notifications.map((n) => (
            <motion.li
              key={n.title}
              className={styles.banner}
              variants={{ hidden: { opacity: 0, x: -24, filter: "blur(6px)" }, visible: { opacity: 1, x: 0, filter: "blur(0px)" } }}
              transition={{ duration: 0.8, ease }}
            >
              <span className={styles.appIcon} />
              <div>
                <span className={styles.bannerApp}>
                  Monolith <em>{n.time}</em>
                </span>
                <strong>{n.title}</strong>
                <span>{n.body}</span>
              </div>
            </motion.li>
          ))}
        </motion.ul>

        <div className={styles.inboxPhone}>
          <Device shot={shots.inboxDark} width="100%" />
        </div>

        <motion.div
          className={styles.activityCol}
          initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1, delay: 0.4, ease }}
        >
          <div className={styles.island}>
            <span className={styles.islandMark} />
            <span className={styles.islandRing}>
              <svg viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" />
                <motion.circle
                  cx="10"
                  cy="10"
                  r="8"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: build.progress / 100 }}
                  viewport={{ once: true }}
                  transition={{ duration: 2, delay: 0.8, ease }}
                />
              </svg>
            </span>
          </div>
          <div className={styles.activity}>
            <div className={styles.activityTop}>
              <span className={styles.appIcon} />
              <div>
                <strong>Android release build</strong>
                <span>{build.project} · Gradle</span>
              </div>
              <em>{build.progress}%</em>
            </div>
            <span className={styles.track}>
              <motion.span
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: build.progress / 100 }}
                viewport={{ once: true }}
                transition={{ duration: 2, delay: 0.8, ease }}
              />
            </span>
          </div>
        </motion.div>
      </div>
    </Panel>
  );
}
