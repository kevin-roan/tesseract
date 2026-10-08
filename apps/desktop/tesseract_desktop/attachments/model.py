import mimetypes
import secrets
import time
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field, replace
from typing import Literal

from ..api.types import Upload, UploadKind
from ..strings import ATTACHMENTS as S
from ..util.format import format_bytes

# Mirrors LIMITS in packages/protocol/src/constants.ts.
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_ATTACHMENTS = 10
MAX_NAME_LENGTH = 255
FALLBACK_MIME_TYPE = "application/octet-stream"
PNG_MIME_TYPE = "image/png"

KIND_ICONS: Mapping[UploadKind, str] = {"image": "image", "pdf": "file-pdf", "audio": "audio", "file": "file"}

Status = Literal["uploading", "ready", "error"]


@dataclass(frozen=True)
class PickedFile:
    name: str
    mime_type: str
    size_bytes: int | None
    path: str | None = None
    data: bytes | None = None


@dataclass(frozen=True)
class DraftAttachment:
    key: str
    file: PickedFile
    kind: UploadKind
    status: Status = "uploading"
    upload: Upload | None = None
    error: str | None = None

    @property
    def name(self) -> str:
        return self.file.name


def upload_kind_of(mime_type: str) -> UploadKind:
    if mime_type.startswith("image/"):
        return "image"
    if mime_type.startswith("audio/"):
        return "audio"
    if mime_type == "application/pdf":
        return "pdf"
    return "file"


def mime_type_of(name: str, hint: str | None = None) -> str:
    if hint and hint.strip() and "/" in hint:
        return hint.strip()
    guessed, _encoding = mimetypes.guess_type(name, strict=False)
    return guessed or FALLBACK_MIME_TYPE


def upload_name(name: str) -> str:
    return name.strip()[:MAX_NAME_LENGTH] or "file"


def pasted_image_name(now: float | None = None) -> str:
    return f"pasted-image-{int((now if now is not None else time.time()) * 1000):x}.png"


def too_large_message(name: str) -> str:
    return S["too_large"].format(name=name, limit=format_bytes(MAX_UPLOAD_BYTES))


def too_many_message() -> str:
    return S["too_many"].format(limit=MAX_ATTACHMENTS)


def remaining_slots(current: int) -> int:
    return max(0, MAX_ATTACHMENTS - current)


def is_too_large(file: PickedFile) -> bool:
    return file.size_bytes is not None and file.size_bytes > MAX_UPLOAD_BYTES


def admit_files(files: Iterable[PickedFile], current: int) -> tuple[list[PickedFile], list[str]]:
    rejected: list[str] = []
    sized = []
    for file in files:
        if is_too_large(file):
            rejected.append(too_large_message(file.name))
        else:
            sized.append(file)
    slots = remaining_slots(current)
    if len(sized) > slots:
        rejected.append(too_many_message())
    return sized[:slots], rejected


def default_prompt_for(kinds: list[UploadKind]) -> str:
    images = sum(1 for kind in kinds if kind == "image")
    if images == len(kinds):
        return S["prompt_image"] if images == 1 else S["prompt_images"]
    return S["prompt_file"] if len(kinds) == 1 else S["prompt_files"]


def draft_key(index: int) -> str:
    return f"att-{int(time.time() * 1000):x}-{index}-{secrets.token_hex(3)}"


def read_file(file: PickedFile) -> bytes:
    """Bytes to upload; raises ValueError for files over the limit (sizes can change after picking)."""
    if file.data is not None:
        data = file.data
    elif file.path is not None:
        with open(file.path, "rb") as handle:
            data = handle.read(MAX_UPLOAD_BYTES + 1)
    else:
        raise ValueError(S["no_path"].format(name=file.name))
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError(too_large_message(file.name))
    return data


@dataclass
class Drafts:
    """The attachments of one unsent message, in the order they were added."""

    items: list[DraftAttachment] = field(default_factory=list)

    def add(self, files: Iterable[PickedFile]) -> tuple[list[DraftAttachment], list[str]]:
        accepted, rejected = admit_files(files, len(self.items))
        drafts = [DraftAttachment(draft_key(i), file, upload_kind_of(file.mime_type)) for i, file in enumerate(accepted)]
        self.items.extend(drafts)
        return drafts, rejected

    def get(self, key: str) -> DraftAttachment | None:
        return next((item for item in self.items if item.key == key), None)

    def patch(self, key: str, **changes: object) -> DraftAttachment | None:
        for index, item in enumerate(self.items):
            if item.key == key:
                self.items[index] = replace(item, **changes)  # type: ignore[arg-type]
                return self.items[index]
        return None

    def remove(self, key: str) -> bool:
        before = len(self.items)
        self.items = [item for item in self.items if item.key != key]
        return len(self.items) != before

    def clear(self) -> None:
        self.items = []

    @property
    def upload_ids(self) -> list[str]:
        return [item.upload["id"] for item in self.items if item.status == "ready" and item.upload]

    @property
    def is_uploading(self) -> bool:
        return any(item.status == "uploading" for item in self.items)

    @property
    def has_failed(self) -> bool:
        return any(item.status == "error" for item in self.items)

    @property
    def blocked(self) -> bool:
        return self.is_uploading or self.has_failed

    @property
    def can_attach(self) -> bool:
        return remaining_slots(len(self.items)) > 0

    def prompt(self, text: str) -> str:
        return text.strip() or default_prompt_for([item.kind for item in self.items])
