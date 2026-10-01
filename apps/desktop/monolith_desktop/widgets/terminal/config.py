from types import MappingProxyType

FONT_SIZE_PX = 14
FONT_SIZE_MIN_PX = 8
FONT_SIZE_MAX_PX = 36
LINE_HEIGHT = 1.12
PADDING_PX = 10
DEFAULT_GRID = (100, 30)
RESIZE_DEBOUNCE_MS = 90
BLINK_INTERVAL_MS = 530
FEED_BUDGET_S = 0.012
FEED_SLICE = 16384
SYNC_TIMEOUT_MS = 200
WHEEL_LINES = 3
LAYOUT_CACHE_SIZE = 4096
ROW_CACHE_SIZE = 2048
SELECTION_AUTOSCROLL_MS = 60

MENU = MappingProxyType({"copy": "term.copy", "paste": "term.paste", "select-all": "term.select-all", "clear": "term.clear"})
