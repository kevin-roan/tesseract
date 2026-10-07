export interface ModifierState {
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

type Listener = (active: boolean) => void;

export interface AccelGuard {
  readonly active: boolean;
  readonly count: number;
  acquire(): () => void;
  release(): void;
  subscribe(listener: Listener): () => void;
  reset(): void;
}

export function createAccelGuard(): AccelGuard {
  let count = 0;
  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach((listener) => listener(count > 0));
  const release = () => {
    if (count === 0) return;
    count -= 1;
    if (count === 0) notify();
  };
  return {
    get active() {
      return count > 0;
    },
    get count() {
      return count;
    },
    acquire() {
      count += 1;
      if (count === 1) notify();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        release();
      };
    },
    release,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      if (count === 0) return;
      count = 0;
      notify();
    },
  };
}

export const accelGuard = createAccelGuard();

export function isGuardExempt(event: ModifierState): boolean {
  return event.metaKey || (event.ctrlKey && event.shiftKey);
}

export function shouldSuspendShortcut(event: ModifierState, guard: Pick<AccelGuard, "active"> = accelGuard): boolean {
  return guard.active && !isGuardExempt(event);
}
