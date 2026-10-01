import hashlib
import os
import socket
import urllib.error
import urllib.request
from collections.abc import Callable

from ...api.client import USER_AGENT, ControllerClient
from ...api.errors import NetworkError, RequestTimeout, error_from_response
from ...api.paths import rest
from .labels import ARTIFACTS

CHUNK_BYTES = 256 * 1024
PART_SUFFIX = ".part"
SHA_HEADER = "X-Content-SHA256"


class ChecksumMismatch(Exception):
    pass


def checksum_matches(expected: str | None, actual: str) -> bool:
    return not expected or expected.strip().lower() == actual.lower()


def download_artifact(
    client: ControllerClient,
    artifact_id: str,
    destination: str,
    expected_sha256: str | None = None,
    on_progress: Callable[[int, int | None], None] | None = None,
) -> str:
    request = urllib.request.Request(
        client.http_url(rest.artifact_download(artifact_id)),
        headers={**client.auth_headers(), "User-Agent": USER_AGENT},
    )
    partial = destination + PART_SUFFIX
    digest = hashlib.sha256()
    try:
        with urllib.request.urlopen(request, timeout=client.timeout) as response:
            length = response.headers.get("Content-Length")
            total = int(length) if length and length.isdigit() else None
            expected = expected_sha256 or response.headers.get(SHA_HEADER)
            received = 0
            with open(partial, "wb") as out:
                while chunk := response.read(CHUNK_BYTES):
                    out.write(chunk)
                    digest.update(chunk)
                    received += len(chunk)
                    if on_progress:
                        on_progress(received, total)
    except urllib.error.HTTPError as error:
        raise error_from_response(error.code, error.read()) from None
    except (TimeoutError, socket.timeout) as error:
        _discard(partial)
        raise RequestTimeout("artifact download timed out") from error
    except urllib.error.URLError as error:
        _discard(partial)
        raise NetworkError(str(error.reason)) from error
    except OSError:
        _discard(partial)
        raise
    if not checksum_matches(expected, digest.hexdigest()):
        _discard(partial)
        raise ChecksumMismatch(ARTIFACTS["checksum"])
    os.replace(partial, destination)
    return destination


def _discard(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass
