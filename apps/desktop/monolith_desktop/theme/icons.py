from types import MappingProxyType

ICONS = MappingProxyType({
    "brand": ("monolith-brand-symbolic", "computer-symbolic"),
    "overview": ("lc-house-symbolic", "go-home-symbolic"),
    "sandbox": ("lc-box-symbolic", "monolith-brand-symbolic", "computer-symbolic"),
    "host": ("lc-monitor-symbolic", "computer-symbolic"),
    "projects": ("lc-box-symbolic", "folder-symbolic"),
    "project": ("lc-box-symbolic", "folder-symbolic"),
    "processes": ("lc-square-terminal-symbolic", "system-run-symbolic"),
    "terminal": ("lc-square-terminal-symbolic", "utilities-terminal-symbolic", "terminal-symbolic", "system-run-symbolic"),
    "builds": ("lc-hammer-symbolic", "applications-engineering-symbolic"),
    "artifacts": ("lc-package-symbolic", "package-x-generic-symbolic", "folder-download-symbolic"),
    "files": ("lc-files-symbolic", "folder-download-symbolic", "folder-symbolic"),
    "save": ("lc-download-symbolic", "document-save-symbolic"),
    "agents": ("lc-mouse-pointer-2-symbolic", "starred-symbolic", "emoji-symbols-symbolic"),
    "inbox": ("lc-inbox-symbolic", "mail-unread-symbolic", "mail-message-new-symbolic"),
    "display": ("lc-monitor-symbolic", "video-display-symbolic"),
    "ports": ("lc-globe-symbolic", "network-wired-symbolic"),
    "usage": ("lc-chart-column-symbolic", "utilities-system-monitor-symbolic", "view-grid-symbolic"),
    "sessions": ("lc-history-symbolic", "document-open-recent-symbolic"),
    "context": ("lc-file-text-symbolic", "text-x-generic-symbolic", "document-properties-symbolic"),
    "pair": ("lc-qr-code-symbolic", "phone-symbolic"),
    "appearance": ("lc-sun-moon-symbolic", "weather-clear-night-symbolic", "preferences-desktop-appearance-symbolic"),
    "settings": ("lc-settings-symbolic", "preferences-system-symbolic", "emblem-system-symbolic"),
    "connection": ("lc-plug-symbolic", "network-server-symbolic"),
    "microphone": ("lc-mic-symbolic", "audio-input-microphone-symbolic"),
    "cpu": ("lc-cpu-symbolic", "cpu-symbolic", "processor-symbolic", "computer-symbolic"),
    "memory": ("lc-memory-stick-symbolic", "memory-symbolic", "drive-multidisk-symbolic"),
    "disk": ("lc-hard-drive-symbolic", "drive-harddisk-symbolic"),
    "network": ("lc-network-symbolic", "network-wired-symbolic"),
    "uptime": ("lc-clock-symbolic", "alarm-symbolic", "appointment-soon-symbolic"),
    "version": ("lc-info-symbolic", "help-about-symbolic"),
    "offline": ("lc-cloud-off-symbolic", "network-offline-symbolic", "network-error-symbolic"),
    "error": ("lc-circle-alert-symbolic", "dialog-error-symbolic"),
    "warning": ("lc-triangle-alert-symbolic", "dialog-warning-symbolic"),
    "info": ("lc-info-symbolic", "dialog-information-symbolic"),
    "success": ("lc-circle-check-symbolic", "emblem-ok-symbolic", "object-select-symbolic"),
    "failed": ("lc-circle-x-symbolic", "dialog-error-symbolic"),
    "refresh": ("lc-refresh-cw-symbolic", "view-refresh-symbolic"),
    "menu": ("lc-menu-symbolic", "open-menu-symbolic"),
    "more": ("lc-ellipsis-symbolic", "view-more-symbolic", "open-menu-symbolic"),
    "archive": ("lc-archive-symbolic", "mail-archive-symbolic", "archive-insert-symbolic", "folder-download-symbolic"),
    "unarchive": ("lc-archive-restore-symbolic", "mail-unarchive-symbolic", "archive-extract-symbolic", "edit-undo-symbolic"),
    "add": ("lc-plus-symbolic", "list-add-symbolic"),
    "stop": ("lc-square-symbolic", "process-stop-symbolic", "media-playback-stop-symbolic"),
    "play": ("lc-play-symbolic", "media-playback-start-symbolic"),
    "down": ("lc-arrow-down-symbolic", "go-down-symbolic"),
    "sync": ("lc-cloud-download-symbolic", "folder-download-symbolic", "go-down-symbolic"),
    "sync-to-host": ("lc-cloud-upload-symbolic", "folder-upload-symbolic", "go-up-symbolic"),
    "sync-from-host": ("lc-cloud-download-symbolic", "folder-download-symbolic", "go-down-symbolic"),
    "revert": ("lc-undo-2-symbolic", "edit-undo-symbolic"),
    "copy": ("lc-copy-symbolic", "edit-copy-symbolic"),
    "rename": ("lc-pencil-symbolic", "document-edit-symbolic", "edit-symbolic"),
    "external": ("lc-external-link-symbolic", "send-to-symbolic", "go-jump-symbolic"),
    "search": ("lc-search-symbolic", "system-search-symbolic"),
    "docker": ("lc-container-symbolic", "network-server-symbolic"),
    "empty": ("lc-folder-open-symbolic", "folder-open-symbolic", "folder-symbolic"),
    "send": ("lc-arrow-up-symbolic", "mail-send-symbolic", "go-up-symbolic"),
    "compose": ("lc-square-pen-symbolic", "document-edit-symbolic", "list-add-symbolic"),
    "chat": ("lc-message-circle-symbolic", "chat-bubble-text-symbolic", "user-available-symbolic", "mail-message-new-symbolic"),
    "branch": ("lc-git-branch-symbolic", "media-playlist-shuffle-symbolic"),
    "commit": ("lc-git-commit-horizontal-symbolic", "emblem-default-symbolic", "object-select-symbolic"),
    "tool": ("lc-wrench-symbolic", "applications-utilities-symbolic", "system-run-symbolic"),
    "keyboard": ("lc-keyboard-symbolic", "input-keyboard-symbolic"),
    "fullscreen": ("lc-maximize-2-symbolic", "view-fullscreen-symbolic"),
    "exit-fullscreen": ("lc-minimize-2-symbolic", "view-restore-symbolic"),
    "fit": ("lc-scan-symbolic", "zoom-fit-best-symbolic", "view-fullscreen-symbolic"),
    "view-only": ("lc-eye-symbolic", "view-reveal-symbolic"),
    "back": ("lc-arrow-left-symbolic", "go-previous-symbolic"),
    "forward": ("lc-arrow-right-symbolic", "go-next-symbolic"),
    "expand": ("lc-chevron-down-symbolic", "pan-down-symbolic", "go-down-symbolic"),
    "collapse": ("lc-chevron-right-symbolic", "pan-end-symbolic", "go-next-symbolic"),
    "sidebar": ("lc-panel-left-symbolic", "sidebar-show-symbolic", "view-dual-symbolic"),
    "browser": ("lc-globe-symbolic", "web-browser-symbolic", "send-to-symbolic"),
    "delete": ("lc-trash-2-symbolic", "user-trash-symbolic", "edit-delete-symbolic"),
    "close": ("lc-x-symbolic", "window-close-symbolic"),
    "filter": ("lc-list-filter-symbolic", "view-filter-symbolic"),
    "display-options": ("lc-sliders-horizontal-symbolic", "preferences-system-symbolic"),
    "details": ("lc-panel-right-symbolic", "sidebar-show-right-symbolic"),
    "notifications": ("lc-bell-symbolic", "preferences-system-notifications-symbolic"),
    "favorite": ("lc-star-symbolic", "starred-symbolic"),
    "views": ("lc-layers-symbolic", "view-grid-symbolic"),
    "issues": ("lc-copy-symbolic", "view-list-symbolic"),
    "my-issues": ("lc-scan-symbolic", "view-list-symbolic"),
    "status-backlog": ("lc-circle-dashed-symbolic", "content-loading-symbolic"),
    "status-todo": ("lc-circle-symbolic", "radio-symbolic"),
    "status-progress": ("lc-circle-dot-symbolic", "media-record-symbolic"),
    "status-done": ("lc-circle-check-symbolic", "emblem-ok-symbolic"),
    "status-done-all": ("lc-check-check-symbolic", "lc-check-symbolic", "emblem-ok-symbolic"),
    "status-canceled": ("lc-circle-x-symbolic", "process-stop-symbolic"),
    "assignee": ("lc-circle-user-symbolic", "avatar-default-symbolic"),
    "label": ("lc-tag-symbolic", "tag-symbolic"),
    "link": ("lc-link-symbolic", "insert-link-symbolic"),
    "check": ("lc-check-symbolic", "object-select-symbolic"),
    "whats-new": ("lc-sparkles-symbolic", "starred-symbolic"),
    "fix-ai": ("lc-sparkles-symbolic", "starred-symbolic"),
    "team": ("lc-square-user-symbolic", "system-users-symbolic"),
    "caret-down": ("lc-chevron-down-symbolic", "pan-down-symbolic"),
    "caret-right": ("lc-chevron-right-symbolic", "pan-end-symbolic"),
    "chevron-left": ("lc-chevron-left-symbolic", "go-previous-symbolic"),
    "minus": ("lc-minus-symbolic", "list-remove-symbolic"),
    "help": ("lc-circle-help-symbolic", "help-browser-symbolic"),
    "logout": ("lc-log-out-symbolic", "system-log-out-symbolic"),
    "file-code": ("lc-file-code-symbolic", "text-x-script-symbolic"),
    "file-archive": ("lc-file-archive-symbolic", "package-x-generic-symbolic"),
    "smartphone": ("lc-smartphone-symbolic", "phone-symbolic"),
    "app-window": ("lc-app-window-symbolic", "application-x-executable-symbolic"),
    "window-minimize": ("window-minimize-symbolic",),
    "window-maximize": ("window-maximize-symbolic",),
    "window-restore": ("window-restore-symbolic",),
    "window-close": ("window-close-symbolic",),
    "paste": ("lc-clipboard-symbolic", "edit-paste-symbolic"),
    "clear": ("lc-eraser-symbolic", "edit-clear-all-symbolic", "edit-clear-symbolic"),
    "screenshot": ("lc-camera-symbolic", "camera-photo-symbolic", "image-x-generic-symbolic"),
    "confidential": ("lc-lock-symbolic", "changes-prevent-symbolic", "system-lock-screen-symbolic"),
    "shuffle": ("lc-shuffle-symbolic", "media-playlist-shuffle-symbolic", "view-refresh-symbolic"),
    "attach": ("lc-paperclip-symbolic", "mail-attachment-symbolic"),
    "image": ("lc-image-symbolic", "image-x-generic-symbolic"),
    "images": ("lc-images-symbolic", "image-x-generic-symbolic"),
    "file": ("lc-file-symbolic", "text-x-generic-symbolic"),
    "file-pdf": ("lc-file-text-symbolic", "x-office-document-symbolic", "text-x-generic-symbolic"),
    "audio": ("lc-audio-waveform-symbolic", "audio-x-generic-symbolic"),
})

LOGO_PREFIX = "logo-"

# Framework -> Simple Icons slug. Drawn as single-color symbolic icons (tools/brand_icons.py), so they follow the text color.
FRAMEWORK_LOGOS = MappingProxyType({
    "expo": "react",
    "react-native": "react",
    "electron": "electron",
    "vite": "vite",
    "next": "nextdotjs",
    "node": "javascript",
    "android": "android",
    "python": "python",
    "flutter": "flutter",
    "unknown": None,
})


def framework_icon(framework: str | None) -> str:
    slug = FRAMEWORK_LOGOS.get(framework or "unknown")
    return f"{LOGO_PREFIX}{slug}-symbolic" if slug else "project"


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
