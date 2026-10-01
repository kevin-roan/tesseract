import io
import subprocess
import tarfile

from monolith_desktop import sync


def git(root, *args):
    subprocess.run(["git", "-C", str(root), "-c", "user.name=T", "-c", "user.email=t@e", *args], check=True, capture_output=True)


def test_plain_directory_includes_everything(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src/main.py").write_text("x")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules/dep.js").write_text("y")
    assert sorted(sync.collect_files(tmp_path)) == ["node_modules/dep.js", "src/main.py"]


def test_git_checkout_skips_ignored_files_and_keeps_git_dir(tmp_path):
    git(tmp_path, "init", "-q")
    (tmp_path / ".gitignore").write_text("node_modules/\n")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules/dep.js").write_text("y")
    (tmp_path / "tracked.txt").write_text("a")
    (tmp_path / "gone.txt").write_text("b")
    git(tmp_path, "add", ".")
    git(tmp_path, "commit", "-qm", "init")
    (tmp_path / "gone.txt").unlink()
    (tmp_path / "new.txt").write_text("c")
    assert sorted(sync.collect_files(tmp_path)) == [".git", ".gitignore", "new.txt", "tracked.txt"]

    out = io.BytesIO()
    sync.write_archive(tmp_path, sync.collect_files(tmp_path), out)
    names = tarfile.open(fileobj=io.BytesIO(out.getvalue()), mode="r:gz").getnames()
    assert "tracked.txt" in names and ".git/HEAD" in names and "node_modules/dep.js" not in names


def test_subdirectory_of_a_checkout_leaves_out_the_repo_git_dir(tmp_path):
    git(tmp_path, "init", "-q")
    (tmp_path / "app").mkdir()
    (tmp_path / "app/index.ts").write_text("a")
    assert list(sync.collect_files(tmp_path / "app")) == ["index.ts"]
