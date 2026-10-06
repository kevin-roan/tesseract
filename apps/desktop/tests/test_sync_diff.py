import io
import os
import tarfile

import pytest

from monolith_desktop.syncback.diff import TooLarge, diff_file, extract_member, read_host_file


def _archive(files: dict[str, bytes]) -> bytes:
    out = io.BytesIO()
    with tarfile.open(fileobj=out, mode="w:gz") as tar:
        for name, data in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    return out.getvalue()


def test_diff_file_marks_hunks_additions_and_removals_with_line_numbers():
    before = b"".join(f"line {i}\n".encode() for i in range(1, 21))
    after = before.replace(b"line 10\n", b"line ten\nline 10.5\n")
    diff = diff_file(before, after)
    assert diff.state == "text"
    assert (diff.added, diff.removed) == (2, 1)
    kinds = [line.kind for line in diff.lines]
    assert kinds[0] == "hunk" and kinds.count("ctx") == 6
    removed = next(line for line in diff.lines if line.kind == "del")
    assert (removed.text, removed.old, removed.new) == ("line 10", 10, None)
    added = [line for line in diff.lines if line.kind == "add"]
    assert [(line.text, line.new) for line in added] == [("line ten", 10), ("line 10.5", 11)]
    assert diff.lines[0].text == "@@ -7,7 +7,8 @@"


def test_diff_file_handles_new_deleted_identical_binary_and_long_diffs():
    assert diff_file(None, b"a\nb\n").added == 2
    deleted = diff_file(b"a\nb\n", None)
    assert (deleted.state, deleted.removed, deleted.after_size) == ("text", 2, None)
    assert diff_file(b"same", b"same").state == "identical"
    assert diff_file(None, b"").state == "empty"
    assert diff_file(b"a", b"a\n").removed == 1
    binary = diff_file(b"\x89PNG\0\0", b"\x89PNG\0\1\2")
    assert (binary.state, binary.before_size, binary.after_size) == ("binary", 6, 7)
    long = diff_file(None, b"x\n" * 50, max_lines=10)
    assert long.truncated and len(long.lines) == 10


def test_extract_member_reads_one_path_and_refuses_large_ones():
    archive = _archive({".github/ci.yml": b"on: push\n", "src/a.ts": b"x"})
    assert extract_member(archive, ".github/ci.yml") == b"on: push\n"
    assert extract_member(archive, "missing") is None
    with pytest.raises(TooLarge):
        extract_member(archive, ".github/ci.yml", limit=3)


def test_read_host_file_reads_files_and_symlinks_and_reports_absence(tmp_path):
    (tmp_path / "a.txt").write_bytes(b"hello")
    os.symlink("a.txt", tmp_path / "link")
    assert read_host_file(tmp_path, "a.txt") == b"hello"
    assert read_host_file(tmp_path, "link") == b"a.txt"
    assert read_host_file(tmp_path, "nope.txt") is None
    with pytest.raises(TooLarge):
        read_host_file(tmp_path, "a.txt", limit=2)
