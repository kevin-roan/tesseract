export function requireElement<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

/** Keeps focus where it is (e.g. the terminal's hidden textarea) so phone keyboards stay open. */
export function keepFocus(element: HTMLElement): void {
  element.addEventListener("pointerdown", (event) => event.preventDefault());
  element.addEventListener("mousedown", (event) => event.preventDefault());
}

/** Space the embedding app's floating chrome covers, exposed to CSS as `--inset-top` / `--inset-bottom`. */
export function applyInsets(insets: { top: number; bottom: number }): void {
  const style = document.documentElement.style;
  style.setProperty("--inset-top", `${insets.top}px`);
  style.setProperty("--inset-bottom", `${insets.bottom}px`);
}

/** Full screen in the embedding app: `[data-immersive]` on the root hides the page's own chrome. */
export function applyImmersive(immersive: boolean): void {
  document.documentElement.toggleAttribute("data-immersive", immersive);
}

/**
 * Sizes the page to the visible area (`--viewport-height`) and pins it to the top, so a phone
 * keyboard shrinks the page instead of covering it or scrolling it out of view.
 */
export function trackVisualViewport(onChange: () => void): void {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const sync = () => {
    document.documentElement.style.setProperty("--viewport-height", `${viewport.height}px`);
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    onChange();
  };
  viewport.addEventListener("resize", sync);
  viewport.addEventListener("scroll", sync);
  sync();
}
