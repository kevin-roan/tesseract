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
