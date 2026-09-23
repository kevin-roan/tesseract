# syntax=docker/dockerfile:1

# TheOne sandbox image. Build context = repository root:
#   docker build -f infra/docker/sandbox/Dockerfile --target sandbox -t theone/sandbox:dev .
# Stages: controller-build, base, desktop, electron, android, sandbox (default).

ARG DEBIAN_IMAGE=debian:trixie-slim
ARG BUN_VERSION=1.4.2
ARG JDK_IMAGE=eclipse-temurin:17-jdk
ARG DEV_UID=1000
ARG DEV_GID=1000

FROM oven/bun:${BUN_VERSION} AS bun

FROM ${JDK_IMAGE} AS jdk

FROM bun AS controller-build
WORKDIR /src
COPY package.json bun.lock bunfig.toml tsconfig.base.json ./
COPY packages/ packages/
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/controller/ apps/controller/
# Only the controller's dependency graph is installed; the mobile manifest is present
# solely so the frozen lockfile resolves.
RUN --mount=type=cache,id=theone-bun-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --filter @theone/controller
RUN bun run --cwd apps/controller build \
 && test -x apps/controller/dist/theone-controller

FROM ${DEBIAN_IMAGE} AS base
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ARG DEBIAN_FRONTEND=noninteractive

ENV LANG=en_US.UTF-8 \
    TZ=UTC \
    THEONE_WORKSPACE=/workspace \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DISABLE_AUTOUPDATER=1

# Keep downloaded .debs in the BuildKit cache mount instead of deleting them, and stop
# package maintainer scripts from trying to start services (there is no init system).
RUN rm -f /etc/apt/apt.conf.d/docker-clean \
 && echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache \
 && printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d \
 && chmod 0755 /usr/sbin/policy-rc.d

RUN --mount=type=cache,id=theone-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=theone-apt-lists,target=/var/lib/apt/lists,sharing=locked \
    apt-get update \
 && apt-get install -y --no-install-recommends \
      bash-completion build-essential bzip2 ca-certificates curl docker-buildx docker-cli \
      docker-compose fd-find file fontconfig fonts-dejavu-core fonts-liberation2 \
      fonts-noto-color-emoji git git-lfs gnupg htop iproute2 jq less locales lsof nano \
      netcat-openbsd openssh-client pipx pkg-config procps psmisc python3 python3-pip \
      python3-venv ripgrep rsync sqlite3 sudo supervisor tini tmux tree tzdata unzip \
      vim-tiny wget xz-utils zip zstd \
 && sed -i 's/^# *\(en_US.UTF-8 UTF-8\)/\1/' /etc/locale.gen \
 && locale-gen \
 && git lfs install --system

# Build args are declared right before their first use: every later RUN is keyed on the
# values of all args in scope, so declaring them earlier re-runs the apt layers on a change.
ARG NODE_MAJOR=24
# Empty = newest ${NODE_MAJOR}.x release at build time; set e.g. 24.21.0 to pin exactly.
ARG NODE_VERSION=
RUN set -eux; \
    case "$(dpkg --print-architecture)" in \
      amd64) node_arch=x64 ;; \
      arm64) node_arch=arm64 ;; \
      *) echo "unsupported architecture" >&2; exit 1 ;; \
    esac; \
    version="${NODE_VERSION#v}"; \
    if [ -z "$version" ]; then \
      version="$(curl -fsSL https://nodejs.org/dist/index.json \
        | jq -r --arg p "v${NODE_MAJOR}." '[.[] | select(.version | startswith($p))][0].version // empty')"; \
      version="${version#v}"; \
    fi; \
    test -n "$version"; \
    tarball="node-v${version}-linux-${node_arch}.tar.xz"; \
    cd /tmp; \
    curl -fsSLO "https://nodejs.org/dist/v${version}/${tarball}"; \
    curl -fsSL "https://nodejs.org/dist/v${version}/SHASUMS256.txt" | grep " ${tarball}\$" | sha256sum -c -; \
    tar -xJf "$tarball" -C /usr/local --strip-components=1 --no-same-owner; \
    rm -f "$tarball" /usr/local/CHANGELOG.md /usr/local/README.md /usr/local/LICENSE; \
    corepack enable; \
    node --version; npm --version; corepack --version

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -sf bun /usr/local/bin/bunx && bun --version

ARG DEV_UID
ARG DEV_GID
ARG ENABLE_SUDO=true
RUN groupadd --gid "${DEV_GID}" dev \
 && useradd --uid "${DEV_UID}" --gid dev --create-home --shell /bin/bash dev \
 && if [ "${ENABLE_SUDO}" = "true" ]; then \
      printf 'dev ALL=(ALL:ALL) NOPASSWD: ALL\n' > /etc/sudoers.d/dev \
      && chmod 0440 /etc/sudoers.d/dev; \
    fi \
 && install -d -o dev -g dev /workspace /workspace/projects /workspace/artifacts /workspace/.agent \
 && install -d -o dev -g dev -m 0700 "/run/user/${DEV_UID}"
ENV XDG_RUNTIME_DIR=/run/user/${DEV_UID}

FROM base AS desktop
ARG DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,id=theone-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=theone-apt-lists,target=/var/lib/apt/lists,sharing=locked \
    apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium dbus-x11 imagemagick libasound2t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 \
      libgbm1 libgtk-3-0t64 libnotify4 libnss3 libsecret-1-0 libxkbcommon0 libxrandr2 libxss1 \
      libxtst6 openbox python3-xdg tigervnc-standalone-server tigervnc-tools x11-apps \
      x11-utils x11-xserver-utils xauth xdg-utils xdotool xterm \
 && install -d -m 1777 /tmp/.X11-unix \
 && sed -i -e '/debian-menu.xml/d' -e '0,/<number>4<\/number>/s//<number>1<\/number>/' /etc/xdg/openbox/rc.xml
ENV THEONE_DISPLAY=:1 \
    THEONE_DISPLAY_GEOMETRY=1600x900 \
    THEONE_VNC_PORT=5901

FROM desktop AS electron
ARG DEBIAN_FRONTEND=noninteractive
# mono runs Squirrel.Windows tooling; without it NSIS, portable and zip targets still work.
# electron-winstaller (Squirrel) requires a `wine64` command, which Debian's wine 10 only
# ships under /usr/lib/wine.
ARG WITH_MONO=true
RUN --mount=type=cache,id=theone-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=theone-apt-lists,target=/var/lib/apt/lists,sharing=locked \
    dpkg --add-architecture i386 \
 && apt-get update \
 && packages=(dpkg-dev fakeroot fonts-wine libwine libwine:i386 osslsigncode rpm wine wine32:i386 wine64) \
 && if [ "${WITH_MONO}" = "true" ]; then packages+=(mono-complete); fi \
 && apt-get install -y --no-install-recommends "${packages[@]}" \
 && ln -sf /usr/lib/wine/wine64 /usr/local/bin/wine64 \
 && wine --version && wine64 --version
ENV WINEPREFIX=/home/dev/.wine \
    WINEARCH=win64 \
    WINEDEBUG=-all \
    APPIMAGE_EXTRACT_AND_RUN=1

FROM ${DEBIAN_IMAGE} AS android-sdk
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ARG DEBIAN_FRONTEND=noninteractive
ARG WITH_ANDROID=true
ARG ANDROID_CMDLINE_TOOLS_BUILD=16111833
ARG ANDROID_CMDLINE_TOOLS_SHA256=0877a1d048fe4a24efe2eff536ca4223f7adeb58648bb81909d33c446918cfa8
ARG ANDROID_PLATFORM=android-36
ARG ANDROID_BUILD_TOOLS=36.0.0
ENV JAVA_HOME=/opt/java/openjdk \
    ANDROID_HOME=/opt/android-sdk
COPY --from=jdk /opt/java/openjdk /opt/java/openjdk
# WITH_ANDROID=false still yields (empty) /opt/java/openjdk and /opt/android-sdk so the
# COPY/ENV instructions of the android stage stay valid.
RUN --mount=type=cache,id=theone-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=theone-apt-lists,target=/var/lib/apt/lists,sharing=locked \
    if [ "${WITH_ANDROID}" != "true" ]; then \
      rm -rf "${JAVA_HOME}" && mkdir -p "${JAVA_HOME}" "${ANDROID_HOME}"; \
      exit 0; \
    fi; \
    set -eux; \
    rm -f /etc/apt/apt.conf.d/docker-clean; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl unzip; \
    curl -fsSLo /tmp/cmdline-tools.zip \
      "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_BUILD}_latest.zip"; \
    echo "${ANDROID_CMDLINE_TOOLS_SHA256}  /tmp/cmdline-tools.zip" | sha256sum -c -; \
    mkdir -p "${ANDROID_HOME}/cmdline-tools" /tmp/cmdline-tools; \
    unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools; \
    mv /tmp/cmdline-tools/cmdline-tools "${ANDROID_HOME}/cmdline-tools/latest"; \
    sdkmanager="${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager"; \
    { yes || true; } | "$sdkmanager" --sdk_root="${ANDROID_HOME}" --licenses > /dev/null; \
    "$sdkmanager" --sdk_root="${ANDROID_HOME}" --install \
      "platform-tools" "platforms;${ANDROID_PLATFORM}" "build-tools;${ANDROID_BUILD_TOOLS}" > /dev/null; \
    "$sdkmanager" --sdk_root="${ANDROID_HOME}" --list_installed; \
    rm -rf /tmp/cmdline-tools /tmp/cmdline-tools.zip

FROM electron AS android
ARG DEV_UID
ARG DEV_GID
COPY --from=android-sdk /opt/java/openjdk /opt/java/openjdk
# dev owns the SDK so Gradle can install missing components (NDK, CMake) on demand.
COPY --from=android-sdk --chown=${DEV_UID}:${DEV_GID} /opt/android-sdk /opt/android-sdk
ENV JAVA_HOME=/opt/java/openjdk \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=${JAVA_HOME}/bin:${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools
# Copied late on purpose: an edit must not invalidate the heavy base/desktop/electron layers.
COPY infra/docker/sandbox/rootfs/etc/profile.d/theone.sh /etc/profile.d/theone.sh

FROM android AS sandbox
# Claude Code is updated by rebuilding with a new CLAUDE_CODE_VERSION (its auto-updater is
# disabled), so it is installed after the toolchain stages: a bump rebuilds only this layer.
ARG CLAUDE_CODE_VERSION=latest
RUN --mount=type=cache,id=theone-npm-cache,target=/root/.npm \
    npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
 && claude --version
ARG THEONE_IMAGE_VERSION=0.1.0
LABEL org.opencontainers.image.title="theone-sandbox" \
      org.opencontainers.image.description="TheOne sandboxed development machine: Xvnc + openbox, wine, Electron/Android/Node tooling, Claude Code and theone-controller" \
      org.opencontainers.image.version="${THEONE_IMAGE_VERSION}" \
      org.opencontainers.image.vendor="TheOne" \
      org.opencontainers.image.base.name="debian:trixie-slim"
COPY infra/docker/sandbox/rootfs/ /
COPY SPEC.md /etc/theone/SPEC.md
RUN chmod 0755 /usr/local/bin/theone-* \
 && install -d -m 1777 /tmp/.X11-unix
COPY --from=controller-build --chmod=0755 /src/apps/controller/dist/theone-controller /usr/local/bin/theone-controller
ENV THEONE_IMAGE_VERSION=${THEONE_IMAGE_VERSION} \
    THEONE_HOST=0.0.0.0 \
    THEONE_PORT=7700 \
    THEONE_DATA_DIR=/workspace/.agent/controller \
    THEONE_VNC_HOST=127.0.0.1
EXPOSE 7700 5901
WORKDIR /workspace
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${THEONE_PORT}/v1/health" > /dev/null || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/theone-entrypoint"]
