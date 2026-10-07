import { useMemo, useRef } from "react";
import { defineGalleryEntry } from "../../app/define";
import { IconButton } from "../IconButton";
import { ActionMenu } from "./ActionMenu";
import { ACTION_MENU_GALLERY, noop } from "./gallery-samples";
import { MenuItem, MenuPanel, MenuSeparator } from "./MenuPanel";
import type { MenuSections } from "./model";
import { useActionMenu, useContextMenu } from "./use-action-menu";
import styles from "./ActionMenu.gallery.module.css";

function ActionMenuGallery() {
  const menu = useActionMenu();
  const moreRef = useRef<HTMLSpanElement>(null);
  const sections = useMemo<MenuSections>(
    () => [
      [
        { label: ACTION_MENU_GALLERY.rename, onSelect: noop },
        { label: ACTION_MENU_GALLERY.pin, onSelect: noop },
        { label: ACTION_MENU_GALLERY.copyLink, onSelect: noop },
      ],
      [],
      [
        { label: ACTION_MENU_GALLERY.archive, icon: "archive", onSelect: noop },
        { label: ACTION_MENU_GALLERY.delete, danger: true, onSelect: noop },
      ],
    ],
    [],
  );
  const contextProps = useContextMenu(menu.openAt);
  return (
    <div className={styles.row}>
      <MenuPanel ariaLabel={ACTION_MENU_GALLERY.menuLabel} className={styles.staticPanel}>
        <MenuItem label={ACTION_MENU_GALLERY.rename} />
        <MenuItem label={ACTION_MENU_GALLERY.pin} />
        <MenuItem label={ACTION_MENU_GALLERY.copyLink} />
        <MenuSeparator />
        <MenuItem label={ACTION_MENU_GALLERY.archive} icon="archive" />
        <MenuItem label={ACTION_MENU_GALLERY.delete} danger />
      </MenuPanel>
      <div className={styles.target} tabIndex={0} {...contextProps}>
        {ACTION_MENU_GALLERY.target}
      </div>
      <span ref={moreRef}>
        <IconButton
          icon="more"
          label={ACTION_MENU_GALLERY.more}
          checked={menu.open}
          onClick={(event) => (menu.open ? menu.close() : menu.openBelow(event.currentTarget))}
        />
      </span>
      <ActionMenu anchor={menu.anchor} sections={sections} onClose={menu.close} ariaLabel={ACTION_MENU_GALLERY.menuLabel} ignoreRef={moreRef} />
    </div>
  );
}

export default defineGalleryEntry({
  id: "action-menu",
  title: "ActionMenu",
  group: "Form controls",
  render: () => <ActionMenuGallery />,
});
