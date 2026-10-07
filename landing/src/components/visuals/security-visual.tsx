"use client";

import { motion } from "motion/react";

import { topology } from "@/content/site";
import { drawIn as draw } from "@/lib/motion";

import Panel from "../panel";
import styles from "./visuals.module.css";

export default function SecurityVisual() {
  const [phone, tailnet, sandbox] = topology;
  return (
    <Panel>
      <svg className={styles.diagram} viewBox="0 0 1100 480" role="img" aria-label="Phone connects to the sandbox only through the tailnet">
        <defs>
          <linearGradient id="wire" x1="250" y1="0" x2="690" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#5e6ad2" stopOpacity="0.2" />
            <stop offset="0.5" stopColor="#8b93ff" />
            <stop offset="1" stopColor="#5e6ad2" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        <text x="40" y="44" className={styles.fig}>FIG 4.0 · NETWORK</text>

        <motion.rect x="640" y="90" width="420" height="320" rx="20" className={styles.boundary} {...draw(0.2)} />
        <text x="660" y="80" className={styles.fig}>DOCKER HOST</text>

        <g className={styles.nodeLine}>
          <motion.path d="M250 250 H430" {...draw(0.5)} />
          <motion.path d="M590 250 H690" {...draw(0.8)} />
        </g>
        <path id="wire-a" d="M250 250 H430" className={styles.wire} />
        <path id="wire-b" d="M590 250 H690" className={styles.wire} />
        {[0, 1.2].map((begin) => (
          <circle key={begin} r="3" className={styles.packet}>
            <animateMotion dur="2.4s" begin={`${begin}s`} repeatCount="indefinite" path="M250 250 H430 M590 250 H690" />
          </circle>
        ))}

        <g className={styles.node}>
          <rect x="90" y="190" width="160" height="120" rx="16" />
          <rect x="150" y="212" width="40" height="72" rx="8" className={styles.glyph} />
          <text x="170" y="336" textAnchor="middle" className={styles.nodeLabel}>{phone.label}</text>
          <text x="170" y="356" textAnchor="middle" className={styles.nodeDetail}>{phone.detail}</text>
        </g>

        <g className={styles.node}>
          <circle cx="510" cy="250" r="80" className={styles.ring} />
          <circle cx="510" cy="250" r="56" />
          <path d="M496 236l14-8 14 8v16l-14 8-14-8z" className={styles.glyph} />
          <text x="510" y="362" textAnchor="middle" className={styles.nodeLabel}>{tailnet.label}</text>
          <text x="510" y="382" textAnchor="middle" className={styles.nodeDetail}>{tailnet.detail}</text>
        </g>

        <g className={styles.node}>
          <rect x="690" y="150" width="320" height="200" rx="16" />
          <text x="714" y="186" className={styles.nodeLabel}>{sandbox.label}</text>
          <text x="714" y="206" className={styles.nodeDetail}>{sandbox.detail}</text>
          {["Claude Code", "Xvnc :1", "Builds", "Terminals"].map((label, i) => (
            <g key={label} transform={`translate(${714 + (i % 2) * 146} ${232 + Math.floor(i / 2) * 50})`}>
              <rect width="134" height="38" rx="9" className={styles.chip} />
              <circle cx="16" cy="19" r="3.5" className={styles.chipDot} />
              <text x="28" y="23.5" className={styles.chipText}>{label}</text>
            </g>
          ))}
        </g>

        <g className={styles.blocked}>
          <text x="850" y="452" textAnchor="middle" className={styles.nodeDetail}>Internet · no public ports</text>
          <path d="M850 410 V432" />
          <path d="M843 418 l14 14 M857 418 l-14 14" className={styles.cross} />
        </g>
      </svg>
    </Panel>
  );
}
