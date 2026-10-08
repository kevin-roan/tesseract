# Live Activities (iOS Dynamic Island)

The controller pushes the sandbox state (`IslandState`) into the app's Live Activity through
APNs. Without the APNs key the feature is off: the app can still register tokens, the controller
stores them and logs `live activity pushes disabled` at `debug`.

## 1. Create the APNs auth key

1. [Apple Developer → Certificates, Identifiers & Profiles → Keys](https://developer.apple.com/account/resources/authkeys/list),
   **+**, name it (e.g. `Tesseract APNs`), tick **Apple Push Notifications service (APNs)**,
   Continue, Register.
2. Download `AuthKey_<KEYID>.p8` once (Apple never shows it again) and note the **Key ID**
   (10 characters) and your **Team ID** (Membership details).
3. Copy the file into the sandbox volume, readable only by the controller user
   (`chmod 600`). One key works for every app of the team and for both APNs environments.

## 2. Configure the controller

Set, in `infra/compose/.env` (or the controller's environment):

| Var | Value |
|---|---|
| `TESSERACT_APNS_KEY_FILE` | absolute path of the `.p8` inside the container, e.g. `/workspace/.agent/controller/AuthKey_ABC123DEF4.p8` |
| `TESSERACT_APNS_KEY_ID` | the key id, e.g. `ABC123DEF4` |
| `TESSERACT_APNS_TEAM_ID` | the team id, e.g. `TEAM123456` |
| `TESSERACT_APNS_BUNDLE_ID` | only when the app is not `com.kevinroan.tesseract` |
| `TESSERACT_APNS_ENV` | `production` (default) or `sandbox` |

All three of key file, key id and team id are required together; setting only some of them
stops the controller with a `ConfigError`. Restart the controller afterwards.

### Sandbox vs production

APNs has two environments and a token is only valid in the one the app was built for:

- **`sandbox`** (`api.sandbox.push.apple.com`): development builds — `npx expo run:ios`, Xcode
  runs, any build whose `aps-environment` entitlement is `development`.
- **`production`** (`api.push.apple.com`): TestFlight and App Store builds.

Sending to the wrong environment returns `400 BadDeviceToken`; the controller then deletes the
token and the app has to register again after you fix `TESSERACT_APNS_ENV`.

## 3. Verify

1. Open the app on the phone; it registers its push-to-start token. Check with
   `tesseract-controller` API: `curl -H "Authorization: Bearer $TOKEN" $URL/v1/push/live-activities`
   should list a `push-to-start` token (and an `activity` token while an activity is showing).
2. Start an agent run from the app. With `TESSERACT_LOG_LEVEL=debug` the controller logs
   `live activity pushed {event: "start", tokens: 1, removed: 0}`, then `update` events while
   the run works and `end` when nothing is running.
3. Problems show up as:
   - `live activity pushes disabled: TESSERACT_APNS_KEY_FILE, …` (debug): the variables are not set.
   - `cannot load the APNs key; live activity pushes disabled` (error): wrong path or not a
     P-256 `.p8` key.
   - `live activity push rejected {status, reason}` (warn): APNs refused it. `403
     InvalidProviderToken` = wrong key id/team id, `400 TopicDisallowed` or `DeviceTokenNotForTopic`
     = wrong bundle id, `400 BadDeviceToken` = wrong environment or a stale token.
   - `apns unreachable` (warn): no route to `api(.sandbox).push.apple.com:443` from the sandbox.
   - `removed live activity tokens {count, event}` (info): tokens APNs reported as gone, or
     `activity` tokens dropped after an `end`.
