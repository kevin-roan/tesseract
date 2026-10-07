# infra/tests

Unit tests for the operator CLI (`infra/scripts/sandbox`), the sandbox rootfs scripts and the
compose files. They are [bats-core](https://bats-core.readthedocs.io) suites that run inside
throwaway containers, so the host only needs docker.

```bash
bun run test:infra                      # everything (about a minute)
bun run test:infra --quick              # skip the stage on the real sandbox image
bun run test:infra --coverage           # kcov line coverage -> infra/tests/coverage/kcov/index.html
bun run test:infra -- -f 'bind address' # extra arguments go to bats
```

## What `run` does

1. Builds `theone/infra-test:bats` (`Dockerfile`, target `bats`: Debian trixie, bats-core with
   bats-support/-assert/-file, kcov, shellcheck, jq, a `dev` user with uid 1000).
2. Renders `sandbox --mode <mode> [--dind] config --format json` for every mode on the host
   with a fixed env file (compose project `theone-test-config`; nothing is created).
3. Runs every suite as root in `theone-test-bats-<pid>`: `--network none`, `infra/` mounted
   read-only at `/repo/infra`, the agent templates and `SPEC.md` mounted where the image has
   them.
4. Unless `--quick`: builds `theone/infra-test:sandbox-bats` from the real sandbox image
   (`THEONE_TEST_SANDBOX_IMAGE`, else the first of `theone/sandbox:latest`, `:dev`, `:e2e`)
   and runs `entrypoint.bats` again in `theone-test-entrypoint-<pid>`, with the image's own
   tools (vncpasswd, wine, the JDK …).

Containers are removed on exit, also on failure and Ctrl-C.

## Suites

| File | Covers |
|---|---|
| `sandbox.bats` | argument parsing, mode precedence, env-file parsing, compose file selection, bind-address checks, port/project validation, every command, against a stub `docker` |
| `compose.bats` | the rendered configurations: published addresses per mode, nothing published in tailscale mode, secret separation, volume names, capabilities, dind |
| `entrypoint.bats` | `theone-entrypoint`: layout and ownership, template seeding idempotency, VNC password and `controller.env`, secrets kept from supervisord, symlink hardening, `ENVIRONMENT.md` |
| `doctor.bats` | every `theone-doctor` check and status, with stubbed probes and a fake RFB server on 127.0.0.1 |
| `rootfs-x11.bats` | `theone-wait-x`, `theone-xvnc` (stale X locks), `theone-screenshot` |
| `rootfs-misc.bats` | `theone-controller-run`, `theone-wine-init`, `/etc/profile.d/theone.sh`, the Claude Code hooks in `/etc/claude-code/managed-settings.json`, the managed `/send-file` skill and its `find-files` helper |
| `lint.bats` | `bash -n`/`sh -n`, shellcheck (warnings), strict mode, supervisord confs vs. rootfs |

Stubs (`lib/common.bash`): `setup_stubs` puts an empty directory first on `PATH`,
`stub <name> [body]` creates a command there that logs its `%q`-quoted argv to `$STUB_LOG`,
and `calls_of <name>` returns them. Tests that write outside their temporary directory
(`/run/theone`, `/usr/local/bin`, `/etc`) skip unless `THEONE_TEST_CONTAINER=1`.
