from gi.repository import Gtk, Pango

from ..theme.manager import theme
from ..util.markdown import Block, inline_markup, parse_blocks
from .code_block import CodeBlock
from .text import Text

HEADING_VARIANTS = {1: "h3", 2: "h4", 3: "bodyStrong"}
INDENT_PX = 18
CHECK_MARKERS = {True: "☑", False: "☐"}


class MarkdownView(Gtk.Box):
    def __init__(
        self,
        text: str = "",
        variant: str = "body",
        color: str = "text",
        selectable: bool = True,
        copy_label: str = "Copy",
        copied_label: str = "Copied",
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=10, css_classes=["to-markdown"])
        self._variant = variant
        self._color = color
        self._selectable = selectable
        self._copy_labels = (copy_label, copied_label)
        self._text: str | None = None
        unsubscribe = theme().subscribe(lambda _scheme: self._rerender())
        self.connect("destroy", lambda *_: unsubscribe())
        self.set_markdown(text)

    @property
    def text(self) -> str:
        return self._text or ""

    def set_markdown(self, text: str) -> None:
        if text == self._text:
            return
        self._text = text
        self._rerender()

    def _rerender(self) -> None:
        while (child := self.get_first_child()) is not None:
            self.remove(child)
        for block in parse_blocks(self._text or ""):
            widget = self._block(block)
            if widget is not None:
                self.append(widget)

    def _markup(self, text: str) -> str:
        return inline_markup(text, theme().hex("accentStrong"), theme().hex("backgroundElement"))

    def _label(self, text: str, variant: str | None = None, color: str | None = None) -> Gtk.Label:
        label = Text("", variant or self._variant, color or self._color, wrap=True, lines=None, selectable=self._selectable)
        label.set_wrap_mode(Pango.WrapMode.WORD_CHAR)
        label.set_markup(self._markup(text))
        label.set_hexpand(True)
        if self._selectable:
            label.set_focusable(False)
        return label

    def _block(self, block: Block) -> Gtk.Widget | None:
        if block.kind == "heading":
            return self._label(block.text, HEADING_VARIANTS.get(block.level, "bodyStrong"))
        if block.kind == "paragraph":
            return self._label(block.text)
        if block.kind == "code":
            return CodeBlock(block.text, block.language, *self._copy_labels)
        if block.kind == "quote":
            box = Gtk.Box(css_classes=["to-md-quote"])
            box.append(self._label(block.text, color="textSecondary"))
            return box
        if block.kind == "rule":
            return Gtk.Separator(css_classes=["to-md-rule"])
        if block.kind == "list":
            return self._list(block)
        if block.kind == "table":
            return self._table(block)
        return None

    def _list(self, block: Block) -> Gtk.Widget:
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, css_classes=["to-md-list"])
        for item in block.items:
            row = Gtk.Box(spacing=8, margin_start=item.depth * INDENT_PX)
            marker = CHECK_MARKERS[item.checked] if item.checked is not None else item.marker
            bullet = Text(marker, self._variant, "textSecondary", xalign=1.0)
            bullet.set_valign(Gtk.Align.START)
            bullet.set_width_chars(2)
            row.append(bullet)
            row.append(self._label(item.text))
            box.append(row)
        return box

    def _table(self, block: Block) -> Gtk.Widget:
        grid = Gtk.Grid(column_spacing=20, row_spacing=6, css_classes=["to-md-table"])
        for row_index, row in enumerate(block.rows):
            for column, cell in enumerate(row):
                label = Text("", "bodyStrong" if row_index == 0 else "bodySmall", selectable=self._selectable)
                label.set_markup(self._markup(cell))
                label.set_ellipsize(Pango.EllipsizeMode.NONE)
                if self._selectable:
                    label.set_focusable(False)
                grid.attach(label, column, row_index, 1, 1)
        return Gtk.ScrolledWindow(
            child=grid,
            hscrollbar_policy=Gtk.PolicyType.AUTOMATIC,
            vscrollbar_policy=Gtk.PolicyType.NEVER,
            propagate_natural_height=True,
            css_classes=["to-md-table-scroller"],
        )
