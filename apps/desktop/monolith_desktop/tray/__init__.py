from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..app import MonolithApplication


def attach(app: "MonolithApplication") -> bool:
    return False


def detach(app: "MonolithApplication") -> None:
    return None
