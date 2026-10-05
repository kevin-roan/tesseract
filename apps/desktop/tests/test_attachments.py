import base64

import pytest

from monolith_desktop.api.client import ControllerClient
from monolith_desktop.api.paths import rest
from monolith_desktop.attachments import model
from monolith_desktop.attachments.model import Drafts, PickedFile
from monolith_desktop.pages.agents.timeline import build_timeline


def picked(name="notes.txt", mime="text/plain", size=10, **kw):
    return PickedFile(name, mime, size, **kw)


def upload(id="upl_1", kind="image"):
    return {"id": id, "name": "a.png", "mimeType": "image/png", "kind": kind, "sizeBytes": 3, "path": "/x", "createdAt": ""}


def test_upload_kind_matches_mobile():
    assert model.upload_kind_of("image/png") == "image"
    assert model.upload_kind_of("audio/m4a") == "audio"
    assert model.upload_kind_of("application/pdf") == "pdf"
    assert model.upload_kind_of("text/plain") == "file"


def test_mime_type_prefers_hint_then_extension():
    assert model.mime_type_of("x.bin", "application/x-thing") == "application/x-thing"
    assert model.mime_type_of("shot.png") == "image/png"
    assert model.mime_type_of("report.pdf", " ") == "application/pdf"
    assert model.mime_type_of("noext") == model.FALLBACK_MIME_TYPE


def test_admit_rejects_large_files_and_overflow():
    big = picked("big.zip", size=model.MAX_UPLOAD_BYTES + 1)
    accepted, rejected = model.admit_files([big, picked("a"), picked("b")], model.MAX_ATTACHMENTS - 1)
    assert [file.name for file in accepted] == ["a"]
    assert rejected == [model.too_large_message("big.zip"), model.too_many_message()]
    assert "20 MB" in rejected[0]
    assert "10" in rejected[1]


def test_unknown_size_is_admitted():
    accepted, rejected = model.admit_files([picked(size=None)], 0)
    assert len(accepted) == 1 and rejected == []


def test_default_prompt_matches_mobile():
    assert model.default_prompt_for(["image"]) == "Take a look at this image."
    assert model.default_prompt_for(["image", "image"]) == "Take a look at these images."
    assert model.default_prompt_for(["pdf"]) == "Take a look at the attached file."
    assert model.default_prompt_for(["image", "file"]) == "Take a look at the attached files."


def test_drafts_lifecycle():
    drafts = Drafts()
    added, rejected = drafts.add([picked("a.png", "image/png"), picked("b.txt")])
    assert rejected == [] and [d.kind for d in added] == ["image", "file"]
    assert drafts.is_uploading and drafts.blocked and drafts.upload_ids == []
    drafts.patch(added[0].key, status="ready", upload=upload("upl_a"))
    drafts.patch(added[1].key, status="error", error="boom")
    assert not drafts.is_uploading and drafts.has_failed and drafts.blocked
    assert drafts.upload_ids == ["upl_a"]
    assert drafts.remove(added[1].key) and not drafts.blocked
    assert drafts.prompt("  ") == "Take a look at this image."
    assert drafts.prompt(" fix it ") == "fix it"
    drafts.clear()
    assert drafts.items == [] and drafts.can_attach


def test_read_file_checks_size(tmp_path, monkeypatch):
    path = tmp_path / "a.txt"
    path.write_bytes(b"hello")
    assert model.read_file(picked(path=str(path))) == b"hello"
    assert model.read_file(picked(data=b"xy")) == b"xy"
    monkeypatch.setattr(model, "MAX_UPLOAD_BYTES", 3)
    with pytest.raises(ValueError):
        model.read_file(picked(path=str(path)))
    with pytest.raises(ValueError):
        model.read_file(picked())


def test_upload_name_is_trimmed_and_capped():
    assert model.upload_name("  a.txt ") == "a.txt"
    assert len(model.upload_name("x" * 300)) == model.MAX_NAME_LENGTH
    assert model.pasted_image_name(1.0) == "pasted-image-3e8.png"


def test_client_uploads_base64_and_sends_attachment_ids(monkeypatch):
    client = ControllerClient("http://sandbox:1", "token")
    sent = []
    monkeypatch.setattr(client, "post", lambda path, body, **_kw: sent.append((path, body)) or {})
    client.create_upload("a.png", "image/png", b"\x89PNG")
    client.start_agent_run("look", "app", None, ["upl_1"])
    client.start_agent_run("look")
    assert sent[0] == ("/v1/uploads", {"name": "a.png", "mimeType": "image/png", "data": base64.b64encode(b"\x89PNG").decode()})
    assert sent[1] == ("/v1/agent/runs", {"prompt": "look", "projectId": "app", "attachmentIds": ["upl_1"]})
    assert sent[2] == ("/v1/agent/runs", {"prompt": "look"})
    assert rest.upload_content("upl_1") == "/v1/uploads/upl_1/content"


def test_timeline_prompt_carries_attachments():
    run = {"id": "run_1", "prompt": "look", "state": "running", "attachments": [upload()]}
    prompt = build_timeline(run, [])[0]
    assert prompt.kind == "prompt" and prompt.attachments == (upload(),)
    assert build_timeline({**run, "attachments": None}, [])[0].attachments == ()
