from types import MappingProxyType

ICONS = MappingProxyType({
    "brand": ("monolith-brand-symbolic", "computer-symbolic"),
    "overview": ("ph-house-symbolic", "go-home-symbolic"),
    "sandbox": ("ph-cube-symbolic", "monolith-brand-symbolic", "computer-symbolic"),
    "host": ("ph-desktop-symbolic", "computer-symbolic"),
    "projects": ("ph-folder-simple-symbolic", "folder-symbolic"),
    "project": ("ph-folder-simple-symbolic", "folder-symbolic"),
    "processes": ("ph-terminal-symbolic", "system-run-symbolic"),
    "terminal": ("ph-terminal-window-symbolic", "utilities-terminal-symbolic", "terminal-symbolic", "system-run-symbolic"),
    "builds": ("ph-hammer-symbolic", "applications-engineering-symbolic"),
    "artifacts": ("ph-package-symbolic", "package-x-generic-symbolic", "folder-download-symbolic"),
    "files": ("ph-files-symbolic", "folder-download-symbolic", "folder-symbolic"),
    "save": ("ph-download-simple-symbolic", "document-save-symbolic"),
    "agents": ("ph-sparkle-symbolic", "starred-symbolic", "emoji-symbols-symbolic"),
    "inbox": ("ph-tray-symbolic", "mail-unread-symbolic", "mail-message-new-symbolic"),
    "display": ("ph-monitor-symbolic", "video-display-symbolic"),
    "ports": ("ph-globe-symbolic", "network-wired-symbolic"),
    "usage": ("ph-chart-bar-symbolic", "utilities-system-monitor-symbolic", "view-grid-symbolic"),
    "sessions": ("ph-clock-counter-clockwise-symbolic", "document-open-recent-symbolic"),
    "context": ("ph-file-text-symbolic", "text-x-generic-symbolic", "document-properties-symbolic"),
    "pair": ("ph-qr-code-symbolic", "phone-symbolic"),
    "settings": ("ph-gear-six-symbolic", "preferences-system-symbolic", "emblem-system-symbolic"),
    "connection": ("ph-plugs-connected-symbolic", "network-server-symbolic"),
    "microphone": ("ph-microphone-symbolic", "audio-input-microphone-symbolic"),
    "cpu": ("ph-cpu-symbolic", "cpu-symbolic", "processor-symbolic", "computer-symbolic"),
    "memory": ("ph-memory-symbolic", "memory-symbolic", "drive-multidisk-symbolic"),
    "disk": ("ph-hard-drives-symbolic", "drive-harddisk-symbolic"),
    "network": ("ph-plugs-connected-symbolic", "network-wired-symbolic"),
    "uptime": ("ph-clock-symbolic", "alarm-symbolic", "appointment-soon-symbolic"),
    "version": ("ph-info-symbolic", "help-about-symbolic"),
    "offline": ("ph-cloud-slash-symbolic", "network-offline-symbolic", "network-error-symbolic"),
    "error": ("ph-warning-circle-symbolic", "dialog-error-symbolic"),
    "warning": ("ph-warning-symbolic", "dialog-warning-symbolic"),
    "info": ("ph-info-symbolic", "dialog-information-symbolic"),
    "success": ("ph-check-circle-symbolic", "emblem-ok-symbolic", "object-select-symbolic"),
    "failed": ("ph-x-circle-symbolic", "dialog-error-symbolic"),
    "refresh": ("ph-arrow-clockwise-symbolic", "view-refresh-symbolic"),
    "menu": ("ph-list-symbolic", "open-menu-symbolic"),
    "more": ("ph-dots-three-symbolic", "view-more-symbolic", "open-menu-symbolic"),
    "archive": ("ph-archive-symbolic", "mail-archive-symbolic", "archive-insert-symbolic", "folder-download-symbolic"),
    "unarchive": ("ph-arrow-counter-clockwise-symbolic", "mail-unarchive-symbolic", "archive-extract-symbolic", "edit-undo-symbolic"),
    "add": ("ph-plus-symbolic", "list-add-symbolic"),
    "stop": ("ph-stop-symbolic", "process-stop-symbolic", "media-playback-stop-symbolic"),
    "play": ("ph-play-symbolic", "media-playback-start-symbolic"),
    "down": ("ph-arrow-down-symbolic", "go-down-symbolic"),
    "sync": ("ph-cloud-arrow-down-symbolic", "folder-download-symbolic", "go-down-symbolic"),
    "copy": ("ph-copy-symbolic", "edit-copy-symbolic"),
    "external": ("ph-arrow-square-out-symbolic", "send-to-symbolic", "go-jump-symbolic"),
    "search": ("ph-magnifying-glass-symbolic", "system-search-symbolic"),
    "docker": ("ph-cube-symbolic", "network-server-symbolic"),
    "empty": ("ph-folder-open-symbolic", "folder-open-symbolic", "folder-symbolic"),
    "send": ("ph-arrow-up-symbolic", "mail-send-symbolic", "go-up-symbolic"),
    "compose": ("ph-plus-symbolic", "document-edit-symbolic", "list-add-symbolic"),
    "chat": ("ph-chat-circle-symbolic", "chat-bubble-text-symbolic", "user-available-symbolic", "mail-message-new-symbolic"),
    "branch": ("ph-git-branch-symbolic", "media-playlist-shuffle-symbolic"),
    "commit": ("ph-git-commit-symbolic", "emblem-default-symbolic", "object-select-symbolic"),
    "tool": ("ph-wrench-symbolic", "applications-utilities-symbolic", "system-run-symbolic"),
    "keyboard": ("ph-keyboard-symbolic", "input-keyboard-symbolic"),
    "fullscreen": ("ph-corners-out-symbolic", "view-fullscreen-symbolic"),
    "exit-fullscreen": ("ph-corners-in-symbolic", "view-restore-symbolic"),
    "fit": ("ph-frame-corners-symbolic", "zoom-fit-best-symbolic", "view-fullscreen-symbolic"),
    "view-only": ("ph-eye-symbolic", "view-reveal-symbolic"),
    "back": ("ph-arrow-left-symbolic", "go-previous-symbolic"),
    "forward": ("ph-arrow-right-symbolic", "go-next-symbolic"),
    "expand": ("ph-caret-down-symbolic", "pan-down-symbolic", "go-down-symbolic"),
    "collapse": ("ph-caret-right-symbolic", "pan-end-symbolic", "go-next-symbolic"),
    "sidebar": ("ph-sidebar-simple-symbolic", "sidebar-show-symbolic", "view-dual-symbolic"),
    "browser": ("ph-globe-symbolic", "web-browser-symbolic", "send-to-symbolic"),
    "delete": ("ph-trash-symbolic", "user-trash-symbolic", "edit-delete-symbolic"),
    "close": ("ph-x-symbolic", "window-close-symbolic"),
    "window-minimize": ("window-minimize-symbolic",),
    "window-maximize": ("window-maximize-symbolic",),
    "window-restore": ("window-restore-symbolic",),
    "window-close": ("window-close-symbolic",),
    "paste": ("ph-clipboard-symbolic", "edit-paste-symbolic"),
    "clear": ("ph-broom-symbolic", "edit-clear-all-symbolic", "edit-clear-symbolic"),
    "screenshot": ("ph-camera-symbolic", "camera-photo-symbolic", "image-x-generic-symbolic"),
    "confidential": ("ph-lock-symbolic", "changes-prevent-symbolic", "system-lock-screen-symbolic"),
    "shuffle": ("ph-shuffle-symbolic", "media-playlist-shuffle-symbolic", "view-refresh-symbolic"),
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
