import { useState } from "react";
import { MenuItem, MenuSeparator } from "../../components/ActionMenu";
import type { KeyComboId } from "../../features/display/constants";
import { DISPLAY_LABELS } from "../../features/display/labels";
import { KEY_ITEMS, MENU_MIN_WIDTH } from "./config";
import { MenuButton } from "./MenuButton";

export interface KeysMenuProps {
  disabled: boolean;
  onSend(id: KeyComboId): void;
}

function KeyItems({ disabled, onPick }: { disabled: boolean; onPick(id: KeyComboId): void }) {
  return (
    <>
      {KEY_ITEMS.map((item) => (
        <MenuItem key={item.id} label={item.label} disabled={disabled} onClick={() => onPick(item.id)} />
      ))}
    </>
  );
}

export function KeysMenu({ disabled, onSend }: KeysMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <MenuButton icon="keyboard" label={DISPLAY_LABELS.sendKeys} disabled={disabled} open={open} onOpenChange={setOpen} minWidth={MENU_MIN_WIDTH}>
      <KeyItems
        disabled={disabled}
        onPick={(id) => {
          setOpen(false);
          onSend(id);
        }}
      />
    </MenuButton>
  );
}

export interface OverflowMenuProps {
  viewOnly: boolean;
  clipboardSync: boolean;
  enabled: {
    viewOnly: boolean;
    clipboard: boolean;
    keys: boolean;
    screenshot: boolean;
    browser: boolean;
  };
  onViewOnly(value: boolean): void;
  onClipboardSync(value: boolean): void;
  onSendKeys(id: KeyComboId): void;
  onScreenshot(): void;
  onBrowser(): void;
}

export function OverflowMenu({ viewOnly, clipboardSync, enabled, onViewOnly, onClipboardSync, onSendKeys, onScreenshot, onBrowser }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState(false);
  const setMenuOpen = (value: boolean) => {
    setOpen(value);
    if (!value) setKeys(false);
  };
  const run = (action: () => void) => {
    setMenuOpen(false);
    action();
  };
  return (
    <MenuButton icon="more" label={DISPLAY_LABELS.more} open={open} onOpenChange={setMenuOpen} minWidth={MENU_MIN_WIDTH}>
      {keys ? (
        <KeyItems disabled={!enabled.keys} onPick={(id) => run(() => onSendKeys(id))} />
      ) : (
        <>
          <MenuItem
            role="menuitemcheckbox"
            aria-checked={viewOnly}
            label={DISPLAY_LABELS.menuViewOnly}
            showCheck
            selected={viewOnly}
            disabled={!enabled.viewOnly}
            onClick={() => run(() => onViewOnly(!viewOnly))}
          />
          <MenuItem
            role="menuitemcheckbox"
            aria-checked={clipboardSync}
            label={DISPLAY_LABELS.menuClipboard}
            showCheck
            selected={clipboardSync}
            disabled={!enabled.clipboard}
            onClick={() => run(() => onClipboardSync(!clipboardSync))}
          />
          <MenuItem label={DISPLAY_LABELS.menuSendKeys} aria-haspopup="menu" disabled={!enabled.keys} onClick={() => setKeys(true)} />
          <MenuSeparator />
          <MenuItem label={DISPLAY_LABELS.menuScreenshot} disabled={!enabled.screenshot} onClick={() => run(onScreenshot)} />
          <MenuItem label={DISPLAY_LABELS.menuBrowser} disabled={!enabled.browser} onClick={() => run(onBrowser)} />
        </>
      )}
    </MenuButton>
  );
}
