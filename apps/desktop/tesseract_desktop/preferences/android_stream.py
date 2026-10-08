from gi.repository import Adw

from ..api.tasks import Task
from ..hostshell import stream
from ..hostshell.stream import StreamState
from ..strings import ANDROID_STREAM as S
from ..widgets.buttons import IconButton
from ..widgets.preference_rows import SettingsActions, SpinRow, choice_row
from .base import PreferencesPage

class AndroidStreamPreferences(PreferencesPage):
    """The host shell's Android screen stream settings, kept in its state file through `host stream`."""

    id = "android-stream"
    order = 16

    def __init__(self, ctx, dialog) -> None:
        super().__init__(ctx, dialog, title=S["title"], icon=S["icon"], description=S["description"])
        self._service = ctx.host_shell
        self._state = StreamState()
        self._draft: dict = {}
        self._saving = False
        self._tasks: list[Task] = []

        refresh = IconButton("refresh", S["refresh"], self._load)
        device_group = Adw.PreferencesGroup(title=S["device_group"], header_suffix=refresh)
        device_row, self._device = choice_row(
            S["device"], S["device_subtitle"], [], lambda option: self._change(device=stream.device_value(option))
        )
        device_group.add(device_row)
        self.add(device_group)

        video = Adw.PreferencesGroup(title=S["video_group"])
        encoding_row, self._encoding = choice_row(
            S["encoding"], S["encoding_subtitle"], stream.encoding_options(), lambda option: self._change(encoding=option)
        )
        self._bit_rate = SpinRow(
            S["bit_rate"], S["bit_rate_subtitle"], stream.BIT_RATE_MBIT, 0.5, lambda value: self._change(bitRate=stream.bit_rate(value)), 1
        )
        self._max_fps = SpinRow(S["max_fps"], S["max_fps_subtitle"], stream.MAX_FPS, 1, lambda value: self._change(maxFps=int(value)))
        size_row, self._max_size = choice_row(
            S["max_size"], S["max_size_subtitle"], stream.max_size_options(), lambda option: self._change(maxSize=stream.max_size_value(option))
        )
        self._key_frame = SpinRow(
            S["key_frame_interval"],
            S["key_frame_interval_subtitle"],
            stream.KEY_FRAME_INTERVAL,
            1,
            lambda value: self._change(keyFrameInterval=int(value)),
        )
        self._jpeg = SpinRow(S["jpeg_quality"], S["jpeg_quality_subtitle"], stream.JPEG_QUALITY, 1, lambda value: self._change(jpegQuality=int(value)))
        for row in (encoding_row, self._bit_rate, self._max_fps, size_row, self._key_frame, self._jpeg):
            video.add(row)
        actions = SettingsActions()
        actions.add(S["reset"], self._reset)
        self._save = actions.add(S["save"], self._on_save, "primary")
        video.add(actions)
        self.add(video)

        self.connect("destroy", lambda *_: self._dispose())
        self._render(self._state)
        self._load()

    def _track(self, task: Task) -> None:
        self._tasks = [t for t in self._tasks if not t.done]
        self._tasks.append(task)

    def _dispose(self) -> None:
        for task in self._tasks:
            task.cancel()

    def _load(self) -> None:
        self._track(self._service.stream(self._render, lambda error: self._toast(S["load_failed"].format(error=error))))

    def _render(self, state: StreamState) -> None:
        """Shows the saved settings with the unsaved edits on top."""
        self._state = state
        settings = {**state.settings, **self._draft}
        self._device.set_options(stream.device_options(state), stream.device_id(settings["device"]))
        self._encoding.select(settings["encoding"])
        self._bit_rate.set_value(stream.mbit(settings["bitRate"]))
        self._max_fps.set_value(settings["maxFps"])
        self._max_size.select(stream.max_size_id(settings["maxSize"]))
        self._key_frame.set_value(settings["keyFrameInterval"])
        self._jpeg.set_value(settings["jpegQuality"])
        self._sync_save()

    def _change(self, **fields) -> None:
        self._draft.update(fields)
        self._sync_save()

    def _sync_save(self) -> None:
        self._save.set_sensitive(not self._saving and bool(stream.changes(self._state.settings, self._draft)))

    def _reset(self) -> None:
        self._draft = dict(stream.DEFAULTS)
        self._render(self._state)

    def _on_save(self) -> None:
        change = stream.changes(self._state.settings, self._draft)
        if not change:
            return
        self._saving = True
        self._sync_save()
        self._track(self._service.update_stream(change, self._on_saved, self._on_save_error))

    def _on_saved(self, state: StreamState) -> None:
        self._saving = False
        self._draft = {}
        self._render(state)
        self._toast(S["saved"])

    def _on_save_error(self, error: BaseException) -> None:
        self._saving = False
        self._sync_save()
        self._toast(S["save_failed"].format(error=error))

    def _toast(self, title: str) -> None:
        self.dialog.add_toast(Adw.Toast(title=title, timeout=6))


PREFERENCES_PAGE = AndroidStreamPreferences
