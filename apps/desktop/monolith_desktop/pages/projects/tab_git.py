from gi.repository import Gtk

from ...api.errors import describe_error
from ...api.types import GitCommit, GitDetails, GitFileStatus, Project
from ...util.format import join_meta, short_sha
from ...widgets.feedback import Notice
from ...widgets.keyed_list import KeyedList
from ...widgets.record_row import RecordRow
from ...widgets.list_view import ListGroup
from .labels import GIT
from .model import commit_meta, git_file_code, git_file_kind, git_file_tone, sync_label

TAB_SPACING = 16


class GitTab:
    def __init__(self) -> None:
        self.widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=TAB_SPACING)
        self._notice = Notice("", tone="warning")
        self._notice.set_visible(False)
        self.widget.append(self._notice)
        self._files = KeyedList(lambda: RecordRow(None, monospace_title=True), self._update_file)
        self._files.add_css_class("divided")
        self._files_section = ListGroup(GIT["files"], self._files, empty_label=GIT["files_empty"], icon="branch")
        self.widget.append(self._files_section)
        self._commits = KeyedList(lambda: RecordRow("commit"), self._update_commit)
        self._commits.add_css_class("divided")
        self._commits_section = ListGroup(GIT["log"], self._commits, empty_label=GIT["log_empty"], icon="commit")
        self.widget.append(self._commits_section)

    def render(self, project: Project | None, details: GitDetails | None, error: BaseException | None) -> None:
        summary = (project or {}).get("git")
        has_git = summary is not None
        self._files_section.set_visible(has_git)
        self._commits_section.set_visible(has_git)
        self._notice.set_visible(error is not None or not has_git)
        if not has_git:
            self._notice.update(GIT["none"], tone="neutral")
            return
        if error is not None:
            self._notice.update(GIT["error"].format(error=describe_error(error)), tone="warning")
        branch = (details or summary).get("branch") or GIT["detached"]
        ahead = (details or summary).get("ahead", 0)
        behind = (details or summary).get("behind", 0)
        files = (details or {}).get("files", [])
        self._files_section.header.set_subtitle(
            join_meta(branch, sync_label(ahead, behind) or GIT["in_sync"], None if files else GIT["clean"])
        )
        if details is None:
            self._files_section.set_loading(error is None)
            self._commits_section.set_loading(error is None)
            return
        self._files_section.set_loading(False)
        self._commits_section.set_loading(False)
        self._files.sync((file["path"], file) for file in files)
        self._files_section.set_empty(not files)
        self._files_section.set_count(len(files))
        commits = details.get("log", [])
        self._commits.sync((commit["sha"], commit) for commit in commits)
        self._commits_section.set_empty(not commits)
        self._commits_section.set_count(len(commits))

    def _update_file(self, row: RecordRow, file: GitFileStatus) -> None:
        row.set_code(git_file_code(file), git_file_tone(file))
        row.set_content(file["path"], None, git_file_kind(file))

    def _update_commit(self, row: RecordRow, commit: GitCommit) -> None:
        row.set_content(commit.get("subject") or short_sha(commit["sha"]), None, commit_meta(commit))
