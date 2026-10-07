"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

import { ease, fadeUp } from "@/lib/motion";

type RevealProps = { children: ReactNode; delay?: number; className?: string; amount?: number };

export default function Reveal({ children, delay = 0, className, amount = 0.25 }: RevealProps) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      transition={{ duration: 1, delay, ease }}
    >
      {children}
    </motion.div>
  );
}
