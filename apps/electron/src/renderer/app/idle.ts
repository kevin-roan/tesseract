import type { QueryClient } from "@tanstack/react-query";

export const IDLE_SETTLE_MS = 300;
export const IDLE_POLL_MS = 50;
export const IDLE_MAX_WAIT_MS = 15_000;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function busy(queryClient: QueryClient): boolean {
  const animating = document.getAnimations().some((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity);
  return queryClient.isFetching() > 0 || queryClient.isMutating() > 0 || animating;
}

export function installIdleProbe(queryClient: QueryClient): void {
  window.__tesseractIdle = async () => {
    await document.fonts.ready;
    const started = performance.now();
    let quietSince = performance.now();
    while (performance.now() - started < IDLE_MAX_WAIT_MS) {
      if (busy(queryClient)) quietSince = performance.now();
      else if (performance.now() - quietSince >= IDLE_SETTLE_MS) break;
      await sleep(IDLE_POLL_MS);
    }
    await nextFrame();
    await nextFrame();
    return true;
  };
}
