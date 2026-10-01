import type { PageState } from "@theone/protocol/bridge";
import { keepFocus } from "./dom";
import type { KeyDefinition, KeyId } from "./config";

export type ConnectionState = PageState;

export class StatusBadge {
  constructor(private readonly element: HTMLElement) {}

  set(state: ConnectionState, text: string): void {
    this.element.dataset.state = state;
    this.element.textContent = text;
  }
}

export class Overlay {
  private readonly text: HTMLElement;
  private readonly button: HTMLButtonElement;
  private action: (() => void) | null = null;

  constructor(private readonly element: HTMLElement) {
    this.text = element.querySelector<HTMLElement>("[data-overlay-text]") ?? element;
    const button = element.querySelector<HTMLButtonElement>("[data-overlay-action]");
    if (!button) throw new Error("Overlay needs a [data-overlay-action] button");
    this.button = button;
    this.button.addEventListener("click", () => this.action?.());
  }

  show(message: string, action?: { label: string; run: () => void }): void {
    this.text.textContent = message;
    this.action = action?.run ?? null;
    this.button.hidden = !action;
    if (action) this.button.textContent = action.label;
    this.element.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
  }
}

/**
 * A row of on-screen keys for phone keyboards that lack Esc, Tab, Ctrl and
 * arrows. Sticky keys toggle and apply to the next key press.
 */
export class KeyBar<K extends string = KeyId> {
  private readonly active = new Set<K>();
  private readonly buttons = new Map<K, HTMLButtonElement>();

  constructor(
    container: HTMLElement,
    keys: readonly KeyDefinition<K>[],
    private readonly onPress: (key: K) => void,
  ) {
    for (const key of keys) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.textContent = key.label;
      button.title = key.title;
      button.setAttribute("aria-label", key.title);
      if (key.sticky) button.setAttribute("aria-pressed", "false");
      keepFocus(button);
      button.addEventListener("click", () => (key.sticky ? this.toggle(key.id) : this.onPress(key.id)));
      container.append(button);
      this.buttons.set(key.id, button);
    }
  }

  isActive(key: K): boolean {
    return this.active.has(key);
  }

  /** Returns whether the sticky key was armed, and releases it. */
  consume(key: K): boolean {
    if (!this.active.has(key)) return false;
    this.setActive(key, false);
    return true;
  }

  setActive(key: K, on: boolean): void {
    if (on) this.active.add(key);
    else this.active.delete(key);
    this.buttons.get(key)?.setAttribute("aria-pressed", String(on));
  }

  private toggle(key: K): void {
    this.setActive(key, !this.active.has(key));
  }
}
