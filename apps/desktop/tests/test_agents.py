from monolith_desktop.api.types import parse_agent_usage, run_total_tokens
from monolith_desktop.pages.agents import model
from monolith_desktop.pages.agents.feed import is_final_message
from monolith_desktop.pages.agents.timeline import EventLog, build_timeline, same_prefix
from monolith_desktop.util.markdown import inline_markup, is_balanced, parse_blocks, plain_text, table_text


def run(**overrides):
    base = {
        "id": "run_1", "projectId": "app", "prompt": "Fix the build", "sessionId": "s1", "state": "succeeded",
        "startedAt": "2026-09-28T10:00:00Z", "endedAt": "2026-09-28T10:00:30Z", "usage": None,
        "result": None, "error": None,
    }
    base.update(overrides)
    return base


def item(**overrides):
    base = {
        "id": "inb_1", "kind": "permission", "title": "Claude needs permission", "body": "Bash", "projectId": None,
        "sessionId": None, "agentRunId": None, "terminalId": None, "createdAt": "", "updatedAt": "", "readAt": None,
    }
    base.update(overrides)
    return base


def test_inline_markup_escapes_everything():
    assert inline_markup("a < b & c > d \"q\" 'x'") == "a &lt; b &amp; c &gt; d &quot;q&quot; &#39;x&#39;"
    assert inline_markup("<b>not bold</b>") == "&lt;b&gt;not bold&lt;/b&gt;"


def test_inline_markup_styles():
    assert inline_markup("**bold** and *it* ~~gone~~") == "<b>bold</b> and <i>it</i> <s>gone</s>"
    assert inline_markup("snake_case_name stays") == "snake_case_name stays"
    assert inline_markup("_it_") == "<i>it</i>"


def test_inline_code_is_escaped_and_not_styled():
    markup = inline_markup("run `a<b> **x**`")
    assert markup == 'run <span font_family="monospace">a&lt;b&gt; **x**</span>'
    colored = inline_markup("`x`", "#fff", "#000")
    assert 'foreground="#fff"' in colored and 'background="#000"' in colored


def test_links_are_escaped_and_scheme_checked():
    assert inline_markup("[docs](https://a.b/?x=1&y=2)") == '<a href="https://a.b/?x=1&amp;y=2">docs</a>'
    assert inline_markup("[bad](javascript:alert(1))") == "bad"
    assert inline_markup("see https://example.com/x.") == 'see <a href="https://example.com/x">https://example.com/x</a>.'
    assert inline_markup('[q](https://x.y/"onclick)').count('"') == 2


def test_unbalanced_emphasis_falls_back_to_plain():
    markup = inline_markup("**a *b** c*")
    assert is_balanced(markup)
    assert "<" not in markup


def test_private_placeholder_chars_are_stripped():
    assert inline_markup("0 `x`") == '0 <span font_family="monospace">x</span>'


def test_is_balanced():
    assert is_balanced("<b><i>x</i></b>")
    assert not is_balanced("<b><i>x</b></i>")
    assert not is_balanced("<script>x</script>")


def test_parse_blocks():
    text = "# Title\nIntro\n- a\n- [x] done\n  more\n1. one\n\n```py\nprint(1)\n```\n| a | b |\n|---|---|\n| 1 | 2 |\n> quote\n---\nend"
    blocks = parse_blocks(text)
    assert [b.kind for b in blocks] == ["heading", "paragraph", "list", "code", "table", "quote", "rule", "paragraph"]
    assert blocks[0].level == 1 and blocks[0].text == "Title"
    items = blocks[2].items
    assert items[1].checked is True and items[1].text == "done more"
    assert items[2].marker == "1."
    assert blocks[3].language == "py" and blocks[3].text == "print(1)"
    assert blocks[4].rows == (("a", "b"), ("1", "2"))


def test_unterminated_fence_keeps_code():
    blocks = parse_blocks("```\nline <x>")
    assert blocks[0].kind == "code" and blocks[0].text == "line <x>"


def test_table_text_and_plain_text():
    assert table_text((("a", "bb"), ("ccc", "d"))).splitlines()[0] == "a    bb"
    assert plain_text("**Fix** the `build` [now](https://x)") == "Fix the build now"


def test_run_title():
    assert model.run_title("\n\n## Fix the **build**\nmore") == "Fix the build"
    assert model.run_title("") == model.UNTITLED
    assert model.run_title("- x" * 1) == "x"
    long = model.run_title("word " * 40)
    assert len(long) <= model.TITLE_LIMIT and long.endswith("…")


def test_filter_and_group_runs():
    names = {"app": "App", "web": "Web"}
    runs = [
        run(id="r1", projectId="app", state="running", startedAt="2026-09-28T10:00:00Z"),
        run(id="r2", projectId="web", prompt="Deploy", startedAt="2026-09-28T11:00:00Z"),
        run(id="r3", projectId=None, prompt="Check disk", startedAt="2026-09-28T09:00:00Z", sessionId="s9"),
    ]
    assert [r["id"] for r in model.filter_runs(runs, "running")] == ["r1"]
    assert [r["id"] for r in model.filter_runs(runs, "all", "web", names)] == ["r2"]
    assert [r["id"] for r in model.filter_runs(runs, "all", "DISK", names)] == ["r3"]
    attention = [item(agentRunId="r3")]
    assert [r["id"] for r in model.filter_runs(runs, "attention", "", names, attention)] == ["r3"]
    groups = model.group_runs(runs, names)
    assert [(g.title, [r["id"] for r in g.runs]) for g in groups] == [
        ("Web", ["r2"]), ("App", ["r1"]), (model.NO_PROJECT, ["r3"])
    ]


def test_attention_helpers():
    items = [item(id="a", agentRunId="r1"), item(id="b", kind="completed"), item(id="c", readAt="x"), item(id="d", sessionId="s1")]
    attention = model.attention_items(items)
    assert [i["id"] for i in attention] == ["a", "d"]
    assert [i["id"] for i in model.attention_for_run(run(id="r1", sessionId="s1"), attention)] == ["a", "d"]
    assert model.badge_count([run(state="running"), run()], {"unreadCount": 3, "attentionCount": 2}) == 3
    assert model.badge_count([], {"unreadCount": 0, "attentionCount": 0}) is None


def test_file_items_are_notices_but_not_attention():
    items = [
        item(id="a"),
        item(id="f", kind="file", artifactId="art_1", agentRunId="r1"),
        item(id="g", kind="file", artifactId=None),
        item(id="h", kind="file", artifactId="art_2", readAt="x"),
    ]
    assert [i["id"] for i in model.attention_items(items)] == ["a"]
    assert [i["id"] for i in model.notice_items(items)] == ["a", "f"]
    assert model.is_file_item(items[1]) and not model.is_file_item(items[2])
    assert model.notice_style(items[1]) == ("files", "info")
    assert model.notice_style(items[0]) == ("warning", "warning")
    runs = [run(id="r1")]
    assert model.filter_runs(runs, "attention", "", {}, model.attention_items(items)) == []


def test_follow_up_and_sessions():
    first = run(id="r1", startedAt="2026-09-28T10:00:00Z")
    second = run(id="r2", startedAt="2026-09-28T11:00:00Z")
    assert model.previous_run(second, [first, second])["id"] == "r1"
    assert model.previous_run(first, [first, second]) is None
    assert model.follow_up_state(run(state="running")) == "running"
    assert model.follow_up_state(run(sessionId=None)) == "no_session"
    assert model.follow_up_state(run()) == "ready"
    sessions = [
        {"sessionId": "s1", "source": "terminal", "terminalId": "t1", "active": True},
        {"sessionId": "s2", "source": "agent-run", "terminalId": None, "active": True},
    ]
    assert model.terminal_for_run(run(), sessions) == "t1"
    assert [s["sessionId"] for s in model.terminal_sessions(sessions)] == ["s1"]


def test_project_options_and_upsert():
    options = model.project_options([{"id": "b", "name": "beta"}, {"id": "a", "name": "Alpha"}])
    assert options == [("", model.NO_PROJECT_OPTION), ("a", "Alpha"), ("b", "beta")]
    runs = model.upsert_run([run(id="r1")], run(id="r1", state="failed"))
    assert runs[0]["state"] == "failed" and len(runs) == 1
    assert [r["id"] for r in model.upsert_run(runs, run(id="r2"))] == ["r2", "r1"]
    assert "events" not in model.strip_events({**run(), "events": []})


def test_manage_actions_skip_running_runs():
    runs = [run(id="r1"), run(id="r2", state="running"), run(id="r3", state="failed")]
    assert model.finished_ids(runs) == ["r1", "r3"]
    assert model.finished_ids(None) == []
    assert model.can_manage(run()) and not model.can_manage(run(state="running")) and not model.can_manage(None)
    assert model.row_actions("running", False) == ()
    assert model.row_actions("succeeded", False) == ("archive", "delete")
    assert model.row_actions("failed", True) == ("unarchive", "delete")


def test_bulk_actions_depend_on_view():
    finished, running = [run()], [run(state="running")]
    assert model.bulk_actions(finished, None, False) == ("archive_all", "delete_all")
    assert model.bulk_actions(running, finished, False) == ()
    assert model.bulk_actions(finished, [], True) == ()
    assert model.bulk_actions(None, finished, True) == ("empty_archive",)
    assert model.action_sections(("archive", "delete")) == [["archive"], ["delete"]]
    assert model.action_sections(("empty_archive",)) == [[], ["empty_archive"]]


def test_archive_helpers():
    assert model.is_archived(run(archivedAt="2026-09-28T10:00:00Z"))
    assert not model.is_archived(run()) and not model.is_archived(run(archivedAt=None))
    assert model.count_label(1) == "1 conversation"
    assert model.count_label(3) == "3 conversations"
    assert model.filter_runs([run()], model.ARCHIVED_FILTER) == [run()]


def test_event_log_dedupes_and_orders():
    log = EventLog()
    assert log.add({"kind": "text", "seq": 2, "ts": "", "text": "b"})
    assert log.add({"kind": "text", "seq": 1, "ts": "", "text": "a"})
    assert not log.add({"kind": "text", "seq": 1, "ts": "", "text": "a"})
    assert not log.add({"kind": "bogus", "seq": 3})
    assert [e["seq"] for e in log.ordered()] == [1, 2]


def events(*specs):
    return [{"seq": index + 1, "ts": "", **spec} for index, spec in enumerate(specs)]


def test_timeline_groups_text_and_pairs_tools():
    items = build_timeline(run(state="running"), events(
        {"kind": "system", "text": "Session started"},
        {"kind": "text", "text": "one"},
        {"kind": "text", "text": "two"},
        {"kind": "tool_use", "tool": "Read", "summary": "a.ts"},
        {"kind": "tool_use", "tool": "Bash", "summary": "ls"},
        {"kind": "tool_result", "tool": "Bash", "isError": True, "summary": "boom"},
    ))
    assert [i.kind for i in items] == ["prompt", "system", "text", "tool", "tool"]
    assert items[2].text == "one\n\ntwo"
    assert (items[3].tool, items[3].status) == ("Read", "pending")
    assert (items[4].tool, items[4].status, items[4].result) == ("Bash", "error", "boom")


def test_timeline_outcome_and_unpaired_results():
    items = build_timeline(run(state="failed", error="Not logged in", result="Not logged in"), events(
        {"kind": "tool_use", "tool": "Read", "summary": "x"},
        {"kind": "tool_result", "tool": None, "isError": False, "summary": "ok"},
        {"kind": "tool_result", "tool": "Grep", "isError": False, "summary": "orphan"},
        {"kind": "text", "text": "Done."},
    ))
    assert items[1].status == "ok"
    assert items[2].key == "result-3" and items[2].result == "orphan"
    outcome = items[-1]
    assert outcome.kind == "outcome" and outcome.state == "failed" and outcome.error == "Not logged in"
    assert outcome.text == ""
    done = build_timeline(run(result="Summary here"), events({"kind": "text", "text": "Other"}))
    assert done[-1].text == "Summary here"
    repeated = build_timeline(run(result="Other"), events({"kind": "text", "text": "Other"}))
    assert repeated[-1].text == ""


def test_timeline_marks_open_tools_unknown_when_finished():
    items = build_timeline(run(state="cancelled"), events({"kind": "tool_use", "tool": "Bash", "summary": "sleep"}))
    assert items[1].status == "unknown"


def test_same_prefix_and_final_messages():
    assert same_prefix(["a", "b"], ["a", "b", "c"])
    assert not same_prefix(["a", "b"], ["a", "c"])
    assert is_final_message({"type": "run", "run": {"state": "succeeded"}})
    assert not is_final_message({"type": "run", "run": {"state": "running"}})
    assert not is_final_message({"type": "event", "event": {}})


def test_usage_parsing_and_token_meta():
    assert parse_agent_usage(None) is None
    assert parse_agent_usage("junk") is None
    usage = parse_agent_usage({"inputTokens": 800, "outputTokens": 42.0, "cacheReadTokens": "x", "cacheWriteTokens": True})
    assert usage == {"inputTokens": 800, "outputTokens": 42, "cacheReadTokens": 0, "cacheWriteTokens": 0, "totalTokens": 842}
    assert run_total_tokens(run()) is None
    tokens = run(usage={"inputTokens": 1, "outputTokens": 1, "cacheReadTokens": 0, "cacheWriteTokens": 0, "totalTokens": 1_234_567})
    assert model.row_meta(tokens, {}).endswith("1.2M tokens")
    assert "$" not in model.header_meta(tokens, {}, 0)
    assert model.row_meta(run(), {}) == model.row_meta(run(usage=None), {})


def test_project_badges_use_framework_logos_and_distinct_tints():
    projects = [{"id": f"p{index}", "framework": "electron" if index == 0 else "expo"} for index in range(9)]
    badges = model.project_badges(projects)
    assert badges["p0"].icon == "logo-electron"
    assert badges["p1"].icon == "logo-react"
    assert len({badge.tint for badge in badges.values()}) == 9


def test_project_badge_falls_back():
    assert model.project_badge(None, {}) == model.NO_PROJECT_BADGE
    assert model.project_badge("gone", {}).icon == "project"
    assert model.project_badges([{"id": "x", "framework": "unknown"}])["x"].icon == "project"
