"use client";

import { motion } from "motion/react";

import { nav } from "@/content/site";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { ease } from "@/lib/motion";

import Brand from "./brand";
import Button from "./button";
import styles from "./nav.module.css";

export default function Nav() {
  const { scrolled } = useScrollDirection();

  return (
    <motion.header
      className={`${styles.root} ${scrolled ? styles.scrolled : ""}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease }}
    >
      <div className={styles.inner}>
        <Brand />
        <nav className={styles.links} aria-label="Sections">
          {nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <Button href="#download" size="sm">
          Download
        </Button>
      </div>
    </motion.header>
  );
}
