import {
  MANAGED_MARKER,
  PROVISION_RETRY,
  SYSBOX_CACHE_DIR,
  SYSBOX_DOWNLOAD_HOST,
  SYSBOX_PACKAGES,
  SYSBOX_RUNC_PATH,
  SYSBOX_SERVICES,
  SYSBOX_VERSION,
} from "./constants";

function fileName(url: string): string {
  return url.slice(url.lastIndexOf("/") + 1);
}

function archCase(): string[] {
  return Object.entries(SYSBOX_PACKAGES).map(
    ([arch, pkg]) => `  ${arch}) url="${pkg.url}"; sum="${pkg.sha256}"; deb="${SYSBOX_CACHE_DIR}/${fileName(pkg.url)}" ;;`,
  );
}

export function sysboxProvisionScript(): string {
  const retry = PROVISION_RETRY;
  return [
    "#!/bin/sh",
    `# ${MANAGED_MARKER}: installs sysbox-ce ${SYSBOX_VERSION} for the sysbox-runc docker runtime`,
    "set -eu",
    "sysbox_active() {",
    `  ${SYSBOX_SERVICES.map((service) => `systemctl is-active --quiet ${service}`).join(" && ")}`,
    "}",
    `if [ -x ${SYSBOX_RUNC_PATH} ] && sysbox_active; then`,
    "  exit 0",
    "fi",
    `if [ ! -x ${SYSBOX_RUNC_PATH} ]; then`,
    '  case "$(dpkg --print-architecture)" in',
    ...archCase(),
    '  *) echo "tesseract: no sysbox-ce package for $(dpkg --print-architecture)" >&2; exit 1 ;;',
    "  esac",
    "  n=0",
    `  until getent hosts ${SYSBOX_DOWNLOAD_HOST} >/dev/null 2>&1; do`,
    "    n=$((n + 1))",
    `    if [ "$n" -ge ${retry.dnsAttempts} ]; then echo "tesseract: can't resolve ${SYSBOX_DOWNLOAD_HOST}" >&2; exit 1; fi`,
    `    sleep ${retry.dnsDelaySeconds}`,
    "  done",
    "  export DEBIAN_FRONTEND=noninteractive",
    "  n=0",
    "  until apt-get update; do",
    "    n=$((n + 1))",
    `    if [ "$n" -ge ${retry.aptAttempts} ]; then exit 1; fi`,
    `    sleep ${retry.aptDelaySeconds}`,
    "  done",
    "  command -v curl >/dev/null 2>&1 || apt-get install -y curl",
    `  mkdir -p ${SYSBOX_CACHE_DIR}`,
    '  if ! echo "$sum  $deb" | sha256sum -c - >/dev/null 2>&1; then',
    `    curl -fsSL --retry ${retry.curlAttempts} --retry-connrefused --retry-delay ${retry.curlDelaySeconds} -o "$deb.part" "$url"`,
    '    echo "$sum  $deb.part" | sha256sum -c -',
    '    mv "$deb.part" "$deb"',
    "  fi",
    '  apt-get install -y "$deb"',
    "fi",
    `systemctl enable --now ${SYSBOX_SERVICES.join(" ")}`,
  ].join("\n");
}
