import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import type { Scheme } from "../../../shared/runtime";
import { FONT_SIZE, HIDE_CURSOR_SEQUENCE, SHIFT_ENTER_SEQUENCE } from "./constants";
import { LINK_LABELS } from "./labels";
import { clampFontSize, isLinkActivation, keyCommand } from "./model";
import type { Grid, TerminalCommand } from "./types";
import { TERMINAL_FONT_PROBE, xtermOptions, xtermTheme } from "./xterm-options";

export interface TerminalHostCallbacks {
  onInput(data: string): void;
  onGrid(grid: Grid): void;
  onTitle(title: string): void;
  onSelection(hasSelection: boolean): void;
  openLink(url: string): void;
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<void>;
}

export interface TerminalHost {
  readonly element: HTMLElement;
  mount(parent: HTMLElement): void;
  unmount(): void;
  refit(): void;
  focus(): void;
  grid(): Grid;
  write(data: string): void;
  reset(): void;
  setInputEnabled(enabled: boolean): void;
  setScheme(scheme: Scheme): void;
  run(command: TerminalCommand): void;
  hasSelection(): boolean;
  mouseTracking(): boolean;
  dispose(): void;
}

export type TerminalHostFactory = (scheme: Scheme, callbacks: TerminalHostCallbacks) => TerminalHost;

class XtermHost implements TerminalHost {
  readonly element: HTMLDivElement;
  private readonly term: Terminal;
  private readonly fit = new FitAddon();
  private opened = false;
  private pendingFocus = false;
  private disposed = false;
  private inputEnabled = true;
  private fontSize: number = FONT_SIZE.default;

  constructor(
    scheme: Scheme,
    private readonly callbacks: TerminalHostCallbacks,
  ) {
    this.element = document.createElement("div");
    this.term = new Terminal({
      ...xtermOptions(scheme),
      linkHandler: {
        activate: (event, uri) => this.activateLink(event, uri),
        hover: () => this.showLinkHint(true),
        leave: () => this.showLinkHint(false),
        allowNonHttpProtocols: false,
      },
    });
    this.term.loadAddon(this.fit);
    this.term.loadAddon(new Unicode11Addon());
    this.term.unicode.activeVersion = "11";
    this.term.loadAddon(new WebLinksAddon((event, uri) => this.activateLink(event, uri), {
        hover: () => this.showLinkHint(true),
        leave: () => this.showLinkHint(false),
      }),);
    this.term.onData((data) => {
      if (this.inputEnabled) callbacks.onInput(data);
    });
    this.term.onResize(({ cols, rows }) => {
      this.term.clearSelection();
      callbacks.onGrid({ cols, rows });
    });
    this.term.onTitleChange((title) => callbacks.onTitle(title));
    this.term.onSelectionChange(() => callbacks.onSelection(this.term.hasSelection()));
    this.term.attachCustomKeyEventHandler((event) => {
      const command = keyCommand(event);
      if (!command) return true;
      event.preventDefault();
      this.run(command);
      return false;
    });
  }

  mount(parent: HTMLElement): void {
    if (this.disposed) return;
    if (this.element.parentElement !== parent) parent.appendChild(this.element);
    if (this.opened) {
      this.refit();
      this.term.refresh(0, this.term.rows - 1);
      return;
    }
    const open = () => {
      if (this.opened || this.disposed || !this.element.isConnected) return;
      this.opened = true;
      this.term.open(this.element);
      this.attachWebgl();
      this.refit();
      if (this.pendingFocus) {
        this.pendingFocus = false;
        this.term.focus();
      }
    };
    const fonts = document.fonts;
    if (fonts && typeof fonts.load === "function") {
      fonts.load(TERMINAL_FONT_PROBE(this.fontSize)).then(open, open);
    } else {
      open();
    }
  }

  unmount(): void {
    this.element.remove();
  }

  refit(): void {
    if (!this.opened || this.disposed || !this.element.isConnected) return;
    if (this.element.clientWidth === 0 || this.element.clientHeight === 0) return;
    this.fit.fit();
  }

  focus(): void {
    if (this.opened) this.term.focus();
    else this.pendingFocus = true;
  }

  grid(): Grid {
    return { cols: this.term.cols, rows: this.term.rows };
  }

  write(data: string): void {
    this.term.write(data);
  }

  reset(): void {
    this.term.reset();
  }

  setInputEnabled(enabled: boolean): void {
    if (this.inputEnabled === enabled) return;
    this.inputEnabled = enabled;
    this.term.options.disableStdin = !enabled;
    if (!enabled) this.term.write(HIDE_CURSOR_SEQUENCE);
  }

  setScheme(scheme: Scheme): void {
    this.term.options.theme = xtermTheme(scheme);
  }

  hasSelection(): boolean {
    return this.term.hasSelection();
  }

  mouseTracking(): boolean {
    return this.term.modes.mouseTrackingMode !== "none";
  }

  run(command: TerminalCommand): void {
    switch (command) {
      case "copy":
        if (this.term.hasSelection()) void this.callbacks.writeClipboard(this.term.getSelection()).catch(() => undefined);
        break;
      case "paste":
        if (this.inputEnabled) {
          void this.callbacks.readClipboard().then(
            (text) => {
              if (text && this.inputEnabled) this.term.paste(text);
            },
            () => undefined,
          );
        }
        break;
      case "selectAll":
        this.term.selectAll();
        break;
      case "zoomIn":
        this.setFontSize(this.fontSize + FONT_SIZE.step);
        break;
      case "zoomOut":
        this.setFontSize(this.fontSize - FONT_SIZE.step);
        break;
      case "zoomReset":
        this.setFontSize(FONT_SIZE.default);
        break;
      case "clear":
        this.term.clear();
        this.term.clearSelection();
        this.term.scrollToBottom();
        break;
      case "pageUp":
        this.term.scrollLines(-(this.term.rows - 1));
        break;
      case "pageDown":
        this.term.scrollLines(this.term.rows - 1);
        break;
      case "scrollTop":
        this.term.scrollToTop();
        break;
      case "scrollBottom":
        this.term.scrollToBottom();
        break;
      case "shiftEnter":
        if (this.inputEnabled) {
          this.term.scrollToBottom();
          this.callbacks.onInput(SHIFT_ENTER_SEQUENCE);
        }
        break;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.element.remove();
    this.term.dispose();
  }

  private activateLink(event: MouseEvent, uri: string): void {
    if (isLinkActivation(event)) this.callbacks.openLink(uri);
  }

  private showLinkHint(show: boolean): void {
    if (show) this.element.title = LINK_LABELS.hint;
    else this.element.removeAttribute("title");
  }

  private attachWebgl(): void {
    if (typeof WebGL2RenderingContext === "undefined") return;
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      this.term.loadAddon(webgl);
    } catch {
      return;
    }
  }

  private setFontSize(size: number): void {
    const next = clampFontSize(size);
    if (next === this.fontSize) return;
    this.fontSize = next;
    this.term.options.fontSize = next;
    this.refit();
  }
}

export const createXtermHost: TerminalHostFactory = (scheme, callbacks) => new XtermHost(scheme, callbacks);
