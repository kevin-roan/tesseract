from tesseract_desktop.migrate import migrate_legacy_dirs


def env_for(tmp_path):
    return {"XDG_CONFIG_HOME": str(tmp_path / "config"), "XDG_STATE_HOME": str(tmp_path / "state")}


def test_copies_legacy_config_and_state_once_and_keeps_the_originals(tmp_path):
    legacy_config = tmp_path / "config/monolith-desktop"
    legacy_config.mkdir(parents=True)
    (legacy_config / "config.json").write_text('{"url": "https://sandbox"}')
    legacy_state = tmp_path / "state/monolith/snapshots"
    legacy_state.mkdir(parents=True)
    (legacy_state / "links.json").write_text("{}")

    migrate_legacy_dirs(env_for(tmp_path))

    assert (tmp_path / "config/tesseract-desktop/config.json").read_text() == '{"url": "https://sandbox"}'
    assert (tmp_path / "state/tesseract/snapshots/links.json").read_text() == "{}"
    assert (legacy_config / "config.json").exists()
    assert (legacy_state / "links.json").exists()

    (legacy_config / "config.json").write_text('{"url": "https://stale"}')
    migrate_legacy_dirs(env_for(tmp_path))
    assert (tmp_path / "config/tesseract-desktop/config.json").read_text() == '{"url": "https://sandbox"}'


def test_falls_back_to_the_theone_config_dir(tmp_path):
    legacy = tmp_path / "config/theone-desktop"
    legacy.mkdir(parents=True)
    (legacy / "config.json").write_text("{}")

    migrate_legacy_dirs(env_for(tmp_path))

    assert (tmp_path / "config/tesseract-desktop/config.json").exists()


def test_does_nothing_without_legacy_dirs(tmp_path):
    migrate_legacy_dirs(env_for(tmp_path))

    assert not (tmp_path / "config").exists()
    assert not (tmp_path / "state").exists()
