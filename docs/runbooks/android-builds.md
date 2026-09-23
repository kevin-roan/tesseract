# Android builds

Android APKs (and AABs) are built inside the sandbox with its own JDK 17 and
Android SDK. The host never needs Android Studio.

## Prerequisites

- The image was built with `WITH_ANDROID=true` (the default). Check with
  `bun run sandbox shell`, then `echo $ANDROID_HOME && ls $ANDROID_HOME`, or
  look at `tools` in `GET /v1/status` (`java` and `adb` have non-null versions).
- Preinstalled: `cmdline-tools;latest`, `platform-tools`, `platforms;android-36`,
  `build-tools;36.0.0`, licenses accepted. `dev` owns `/opt/android-sdk`, so
  Gradle can download missing pieces (NDK, CMake, other platforms) on demand.
  A current Expo app pulls NDK 27.1 and CMake 3.22 this way on its first build.
  Those downloads land in the image layer and **are lost when the container is
  recreated**. Put permanent ones in the Dockerfile (`sdkmanager --install …`
  in the `android-sdk` stage).
- Gradle caches go to `/home/dev/.gradle` (persistent).

## From the phone

1. Agents tab → **Projects** → the project → **Build** → `android-apk`, profile **debug** or **release**.
2. Watch stages (`install` → `compile` → `package` → `collect`) and logs on the build screen.
3. The APK appears under **Artifacts** as
   `<project>-android-<profile>-<version>.apk`. Download it to the phone and
   install it (allow "install unknown apps" for the app you open it with).

What the controller runs (`android-apk` recipe), in the project directory:

```bash
<pm> install                                              # bun/pnpm/yarn/npm by lockfile
<exec> expo prebuild --platform android --no-install      # only if there is no android/ directory (<exec> = npx --yes=false, pnpm exec, …)
cd android && sh ./gradlew assembleDebug --no-daemon --console=plain  # assembleRelease for the release profile
# collect: android/app/build/outputs/apk/**/<profile>/**/*.apk written by this build → /workspace/artifacts/
```

The target is offered for Expo apps (an `expo` dependency plus
`app.json`/`app.config.*`) and for projects with `android/gradlew`. The recipe
sets `ANDROID_HOME`, `ANDROID_SDK_ROOT` and `JAVA_HOME`. Without `java`, the
build request is rejected with `503`. Gradle runs with `--no-daemon`, so no
daemon outlives the build (or its cancel) and holds memory afterwards.

Expect the first build of a fresh Expo app to take about 15 minutes and several
GB of disk (Gradle caches in `/home/dev/.gradle`, NDK and CMake in the SDK). The
e2e run built a blank `create-expo-app` app (which today gives Expo SDK 57 /
RN 0.86, not SDK 56) into a 136 MB debug APK in 14 min 22 s.

## From a sandbox shell or Claude

```bash
cd /workspace/projects/myapp
npx expo prebuild -p android --no-install     # CNG projects only
cd android
./gradlew assembleDebug                       # debug APK
./gradlew assembleRelease                     # release APK (needs signing config)
./gradlew bundleRelease                       # AAB for Play Store
./gradlew --stop                              # free memory afterwards
```

Prefer the controller build (`theone-controller api POST /v1/builds '{"projectId":"myapp","target":"android-apk","profile":"release"}'`,
see [SPEC §8.2](../../SPEC.md#82-local-api)) for deliverables: it survives disconnects and produces the named, hashed artifact.

## Release signing

A release APK needs a keystore. Keep it out of git:

```bash
install -d -m 0700 /home/dev/.secrets/myapp
# copy the keystore there (e.g. through a terminal paste of base64, or scp over the tailnet)
chmod 0600 /home/dev/.secrets/myapp/release.keystore
```

Reference it from the user-level `/home/dev/.gradle/gradle.properties`, which
Gradle reads automatically, not from the project's `android/gradle.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=/home/dev/.secrets/myapp/release.keystore
MYAPP_UPLOAD_KEY_ALIAS=upload
MYAPP_UPLOAD_STORE_PASSWORD=…
MYAPP_UPLOAD_KEY_PASSWORD=…
```

and use those properties in `android/app/build.gradle`'s `signingConfigs`. For
Expo CNG projects, add the signing config through a config plugin so that
prebuild does not overwrite it.

## EAS

`eas build --local` runs the build in the sandbox (install `eas-cli` in the
project or use `npx eas-cli`). Cloud `eas build` uploads the project to Expo's
servers. Both need the user's Expo account (`EXPO_TOKEN`). That is an
external dependency: store the token in `/home/dev/.secrets/`, never in the
repository.

## Limits

- **No emulator:** the container has no KVM. Test on a real device by
  installing the artifact. Wireless `adb` from the sandbox to your phone does
  not work in the default mode: with userspace Tailscale the sandbox cannot
  open connections to other tailnet devices (and the suggested ACLs forbid it).
  See the [roadmap](../roadmap.md#emulator-and-device-access).
- **Memory:** Gradle plus Kotlin daemons easily use 3–4 GiB. Keep the sandbox
  memory limit at 8 GiB or more for React Native projects, and cap Gradle in
  `/home/dev/.gradle/gradle.properties`:

  ```properties
  org.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=768m
  org.gradle.parallel=true
  kotlin.daemon.jvmargs=-Xmx1g
  ```

  Controller builds always pass `--no-daemon`. For manual builds, run
  `./gradlew --stop` when done: a daemon left in a terminal's background is
  stopped when that terminal's shell exits.

- **iOS:** not possible in the sandbox (needs macOS). See the [roadmap](../roadmap.md#ios-builds-via-a-remote-mac).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `SDK location not found` | the image was built with `WITH_ANDROID=false` (empty `/opt/android-sdk`), or a stale `android/local.properties` points elsewhere: rebuild with Android, or set `sdk.dir=/opt/android-sdk` |
| `Failed to install the following SDK components` | Gradle cannot write the SDK. Check `ls -ld /opt/android-sdk` (owned by `dev`) |
| Build killed, `exit code 137` | out of memory: lower `org.gradle.jvmargs`, stop other processes, raise the compose memory limit |
| `Unsupported class file major version` | wrong JDK: `java -version` must say 17; `JAVA_HOME=/opt/java/openjdk` |
| Expo prebuild asks questions | run with `--no-install` and set `android.package` in `app.json` |
| First build very slow, or `ENOSPC` | Gradle downloads dependencies, NDK and CMake; allow ~15 minutes and several GB |

More in [troubleshooting.md](troubleshooting.md).
