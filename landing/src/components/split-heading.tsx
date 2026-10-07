"use client";

import { motion } from "motion/react";

import { ease } from "@/lib/motion";

type SplitHeadingProps = { lines: string[]; className?: string; delay?: number; stagger?: number };

export default function SplitHeading({ lines, className, delay = 0, stagger = 0.045 }: SplitHeadingProps) {
  const words = lines.map((line) => line.split(" "));
  let index = 0;

  return (
    <h1 className={className} aria-label={lines.join(" ")}>
      {words.map((line, l) => (
        <span key={l} style={{ display: "block" }} aria-hidden>
          {line.map((word, w) => {
            const i = index++;
            return (
              <motion.span
                key={w}
                style={{ display: "inline-block", whiteSpace: "pre" }}
                initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.1, delay: delay + i * stagger, ease }}
              >
                {w < line.length - 1 ? `${word} ` : word}
              </motion.span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}
