from dataclasses import asdict, dataclass, replace
from typing import Any, Literal

from ..pairing import build_pairing_link, normalize_base_url

ConfigSource = Literal["file", "env", "docker", "manual"]


@dataclass(frozen=True)
class ConnectionConfig:
    api_url: str
    token: str
    name: str | None = None
    pairing_url: str | None = None
    source: ConfigSource = "manual"
    container: str | None = None

    @property
    def pairing_base_url(self) -> str:
        return self.pairing_url or self.api_url

    def pairing_link(self) -> str:
        return build_pairing_link(self.pairing_base_url, self.token, self.name)

    def is_valid(self) -> bool:
        return bool(self.token) and normalize_base_url(self.api_url) is not None

    def with_(self, **changes: Any) -> "ConnectionConfig":
        return replace(self, **changes)

    def to_json(self) -> dict[str, str]:
        data = {"url": self.api_url, "token": self.token}
        if self.name:
            data["name"] = self.name
        if self.pairing_url:
            data["pairingUrl"] = self.pairing_url
        return data

    @classmethod
    def from_json(cls, data: dict[str, Any], source: ConfigSource = "file") -> "ConnectionConfig | None":
        url = data.get("url") or data.get("apiUrl")
        token = data.get("token")
        if not isinstance(url, str) or not isinstance(token, str) or not url or not token:
            return None
        normalized = normalize_base_url(url)
        if not normalized:
            return None
        pairing = data.get("pairingUrl")
        name = data.get("name")
        return cls(
            api_url=normalized,
            token=token.strip(),
            name=name if isinstance(name, str) and name.strip() else None,
            pairing_url=normalize_base_url(pairing) if isinstance(pairing, str) and pairing else None,
            source=source,
        )

    def redacted(self) -> dict[str, Any]:
        data = asdict(self)
        data["token"] = f"{self.token[:4]}…" if self.token else ""
        return data
