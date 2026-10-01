from dataclasses import dataclass

from ..api.errors import ApiError, describe_error
from ..api.types import STT_PROFILES, SttProfileInfo, SttStatus
from ..strings import STT as S
from ..util.format import join_meta, pluralize

Row = tuple[str, str]


@dataclass(frozen=True)
class ProfileChoice:
    id: str
    title: str
    subtitle: str
    available: bool


def status_error_message(error: BaseException | None) -> str:
    """A 404 on /v1/stt means the controller predates speech-to-text."""
    if isinstance(error, ApiError) and error.status == 404:
        return S["outdated"]
    return describe_error(error)


def profile_title(profile: str) -> str:
    return S.get(f"profile_{profile}", profile)


def profile_details(info: SttProfileInfo | None) -> str:
    if info is None or info["id"] == "off":
        return ""
    return join_meta(info["model"], pluralize(info["threads"], S["thread"]) if info["threads"] else None,
                     S["nice"].format(value=info["nice"]) if info["nice"] else None)


def profile_choices(status: SttStatus | None) -> list[ProfileChoice]:
    infos = {info["id"]: info for info in status["profiles"]} if status else {}
    choices = []
    for profile in STT_PROFILES:
        info = infos.get(profile)
        available = profile == "off" or (info is not None and info["available"])
        lines = [S[f"profile_{profile}_description"], profile_details(info)]
        if status is not None and not available:
            lines.append(S["model_missing"])
        choices.append(ProfileChoice(profile, profile_title(profile), "\n".join(line for line in lines if line), available))
    return choices


def state_label(status: SttStatus) -> str:
    if status["ready"]:
        return S["ready"]
    return join_meta(S["not_ready"], status["reason"])


def activity_label(status: SttStatus) -> str:
    queued = S["queued"].format(count=status["queued"]) if status["queued"] else None
    return join_meta(S["busy"] if status["busy"] else S["idle"], queued)


def status_rows(status: SttStatus) -> list[Row]:
    return [
        (S["engine"], status["engine"] or S["none"]),
        (S["model"], status["model"] or S["none"]),
        (S["state"], state_label(status)),
        (S["activity"], activity_label(status)),
        (S["cpus"], str(status["cpus"]) if status["cpus"] else S["none"]),
    ]
