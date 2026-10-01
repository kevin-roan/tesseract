# Maestro end-to-end flows

Drive the development build on an Android device against a running sandbox.

| Flow | Checks |
|---|---|
| `pair.yaml` | clears app state, checks that the unpaired app opens on onboarding (`onboarding-welcome`, no tab bar), walks the slides to the setup guide and back, then pairs through **Scan pairing code** and the manual form (URL + token) and lands on the tabs |
| `profile.yaml` | Tailscale identity (`profile-name`, `profile-tailnet`, login · DNS name), stats, activity entry for `ticker` |
| `projects.yaml` | `running-section` with `ticker`, `hello-world` card (Running, 1 active task), opens the project and goes back |
| `live-update.yaml` | starts `e2e-sleeper` through the API, waits for it in Running without a refresh, stops it from the app, checks `stopped` through the API |

They expect the seeded sandbox: project `hello-world` with a running process `ticker`.

## Run

```bash
# Metro for this app, reachable from the device
bunx expo start --dev-client --port 8082
adb reverse tcp:8082 tcp:8082

TOKEN=$(bun run --silent sandbox pair --json | jq -r .link | sed 's/.*token=\([^&]*\).*/\1/')
maestro --device <serial> test \
  -e THEONE_URL=http://<controller>:7700 \
  -e THEONE_TOKEN="$TOKEN" \
  -e DEV_SERVER_URL=http%3A%2F%2F127.0.0.1%3A8082 \
  -e OUTPUT_DIR=/tmp/theone-e2e \
  apps/mobile/tests/e2e
```

`config.yaml` runs the flows in order (`pair` first). A single flow can run on its own once the app is paired; each one pairs again if needed (`subflows/pair-if-needed.yaml` skips onboarding, opens the pair modal from the setup guide and waits for the Agents tab). `DEV_SERVER_URL` is URL-encoded and opens the dev client on that Metro server. Screenshots go to `OUTPUT_DIR`.
