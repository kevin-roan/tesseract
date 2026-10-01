from types import MappingProxyType

ICONS = MappingProxyType({
    "overview": ("go-home-symbolic",),
    "sandbox": ("monolith-brand-symbolic", "computer-symbolic"),
    "host": ("computer-symbolic",),
    "projects": ("folder-symbolic",),
    "project": ("folder-symbolic",),
    "processes": ("system-run-symbolic",),
    "terminal": ("utilities-terminal-symbolic", "terminal-symbolic", "system-run-symbolic"),
    "builds": ("applications-engineering-symbolic",),
    "artifacts": ("monolith-package-symbolic", "package-x-generic-symbolic", "folder-download-symbolic"),
    "files": ("monolith-files-symbolic", "folder-download-symbolic", "folder-symbolic"),
    "save": ("document-save-symbolic",),
    "agents": ("monolith-sparkle-symbolic", "starred-symbolic", "emoji-symbols-symbolic"),
    "inbox": ("monolith-inbox-symbolic", "mail-unread-symbolic", "mail-message-new-symbolic"),
    "display": ("video-display-symbolic",),
    "ports": ("network-wired-symbolic",),
    "usage": ("monolith-chart-symbolic", "utilities-system-monitor-symbolic", "view-grid-symbolic"),
    "sessions": ("document-open-recent-symbolic",),
    "context": ("text-x-generic-symbolic", "document-properties-symbolic"),
    "pair": ("monolith-qr-symbolic", "phone-symbolic"),
    "settings": ("preferences-system-symbolic", "emblem-system-symbolic"),
    "cpu": ("monolith-cpu-symbolic", "cpu-symbolic", "processor-symbolic", "computer-symbolic"),
    "memory": ("monolith-memory-symbolic", "memory-symbolic", "drive-multidisk-symbolic"),
    "disk": ("drive-harddisk-symbolic",),
    "network": ("network-wired-symbolic",),
    "uptime": ("alarm-symbolic", "appointment-soon-symbolic"),
    "version": ("help-about-symbolic",),
    "offline": ("network-offline-symbolic", "network-error-symbolic"),
    "error": ("dialog-error-symbolic",),
    "warning": ("dialog-warning-symbolic",),
    "info": ("dialog-information-symbolic",),
    "success": ("emblem-ok-symbolic", "object-select-symbolic"),
    "refresh": ("view-refresh-symbolic",),
    "menu": ("open-menu-symbolic",),
    "more": ("view-more-symbolic", "open-menu-symbolic"),
    "archive": ("mail-archive-symbolic", "archive-insert-symbolic", "folder-download-symbolic"),
    "unarchive": ("mail-unarchive-symbolic", "archive-extract-symbolic", "edit-undo-symbolic"),
    "add": ("list-add-symbolic",),
    "stop": ("process-stop-symbolic", "media-playback-stop-symbolic"),
    "play": ("media-playback-start-symbolic",),
    "down": ("go-down-symbolic",),
    "copy": ("edit-copy-symbolic",),
    "external": ("send-to-symbolic", "go-jump-symbolic"),
    "search": ("system-search-symbolic",),
    "docker": ("network-server-symbolic",),
    "empty": ("folder-open-symbolic", "folder-symbolic"),
    "send": ("mail-send-symbolic", "go-up-symbolic"),
    "compose": ("document-edit-symbolic", "list-add-symbolic"),
    "chat": ("chat-bubble-text-symbolic", "user-available-symbolic", "mail-message-new-symbolic"),
    "branch": ("monolith-branch-symbolic", "media-playlist-shuffle-symbolic"),
    "commit": ("emblem-default-symbolic", "object-select-symbolic"),
    "tool": ("applications-utilities-symbolic", "system-run-symbolic"),
    "keyboard": ("input-keyboard-symbolic",),
    "fullscreen": ("view-fullscreen-symbolic",),
    "fit": ("zoom-fit-best-symbolic", "view-fullscreen-symbolic"),
    "back": ("go-previous-symbolic",),
    "forward": ("go-next-symbolic",),
    "expand": ("pan-down-symbolic", "go-down-symbolic"),
    "collapse": ("pan-end-symbolic", "go-next-symbolic"),
    "sidebar": ("sidebar-show-symbolic", "view-dual-symbolic"),
    "browser": ("web-browser-symbolic", "send-to-symbolic"),
    "delete": ("user-trash-symbolic", "edit-delete-symbolic"),
    "close": ("window-close-symbolic",),
    "window-minimize": ("window-minimize-symbolic",),
    "window-maximize": ("window-maximize-symbolic",),
    "window-restore": ("window-restore-symbolic",),
    "window-close": ("window-close-symbolic",),
    "paste": ("edit-paste-symbolic",),
    "clear": ("edit-clear-all-symbolic", "edit-clear-symbolic"),
    "screenshot": ("camera-photo-symbolic", "image-x-generic-symbolic"),
})

def icon_candidates(name: str) -> tuple[str, ...]:
    return ICONS.get(name, (name,))


def resolve_icon(name: str) -> str:
    candidates = icon_candidates(name)
    try:
        import gi

        gi.require_version("Gtk", "4.0")
        from gi.repository import Gdk, Gtk

        display = Gdk.Display.get_default()
        if display is None:
            return candidates[0]
        icon_theme = Gtk.IconTheme.get_for_display(display)
        for candidate in candidates:
            if icon_theme.has_icon(candidate):
                return candidate
    except (ImportError, ValueError):
        return candidates[0]
    return candidates[0]
