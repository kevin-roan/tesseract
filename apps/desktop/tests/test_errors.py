import json

import pytest

from monolith_desktop.api.errors import (
    ApiError,
    NetworkError,
    NotConfigured,
    ProtocolVersionError,
    RequestTimeout,
    check_protocol_version,
    describe_error,
    error_from_response,
    is_auth_error,
    is_retryable,
)


def test_maps_error_envelope():
    error = error_from_response(409, json.dumps({"error": {"code": "conflict", "message": "exists"}}).encode())
    assert (error.status, error.code, error.message) == (409, "conflict", "exists")


def test_falls_back_to_status_code_and_text():
    error = error_from_response(404, b"nope")
    assert (error.code, error.message) == ("not_found", "nope")
    assert error_from_response(413, b"").code == "internal"
    assert "502" in error_from_response(502, b"").message


def test_auth_detection_and_retry():
    unauthorized = error_from_response(401, json.dumps({"error": {"code": "unauthorized", "message": "x"}}))
    assert is_auth_error(unauthorized)
    assert not is_retryable(error_from_response(400, b""))
    assert is_retryable(error_from_response(503, b""))
    assert is_retryable(NetworkError("down"))
    assert not is_retryable(ProtocolVersionError(2))
    assert not is_retryable(NotConfigured())


def test_protocol_version_check():
    check_protocol_version(1)
    with pytest.raises(ProtocolVersionError):
        check_protocol_version(2)


@pytest.mark.parametrize(
    "error",
    [
        ApiError(401, "unauthorized", "x"),
        ApiError(409, "conflict", "exists"),
        RequestTimeout("slow"),
        NetworkError("down"),
        ProtocolVersionError(2),
        NotConfigured(),
        RuntimeError("boom"),
    ],
)
def test_describe_error_is_human(error):
    assert describe_error(error)
