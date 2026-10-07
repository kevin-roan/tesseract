export const ease = [0.25, 1, 0.5, 1] as const;
export const easeOut = [0.16, 1, 0.3, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

export const appear = (delay: number) => ({
  initial: { opacity: 0, y: 12, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 1, delay, ease },
});

export const drawIn = (delay: number) => ({
  initial: { pathLength: 0, opacity: 0 },
  whileInView: { pathLength: 1, opacity: 1 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 1.4, delay, ease },
});
