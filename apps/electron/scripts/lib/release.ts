import semver from "semver";

export const RELEASE_TYPES = ["patch", "minor", "major"] as const;

const PACKAGE_VERSION = /^(\s*"version":\s*")([^"]+)(")/m;
const LOCK_VERSION = /("name":\s*"@tesseract\/electron",\s*"version":\s*")([^"]+)(")/;

export function nextVersion(current: string, bump: string): string {
  if ((RELEASE_TYPES as readonly string[]).includes(bump)) {
    const next = semver.inc(current, bump as semver.ReleaseType);
    if (next === null) throw new Error(`cannot bump invalid version ${current}`);
    return next;
  }
  const exact = semver.valid(bump);
  if (exact === null) throw new Error(`expected ${RELEASE_TYPES.join(", ")} or a version, got ${bump}`);
  if (!semver.gt(exact, current)) throw new Error(`${exact} is not greater than ${current}`);
  return exact;
}

export function readVersion(packageJson: string): string {
  const match = PACKAGE_VERSION.exec(packageJson);
  if (match?.[2] === undefined) throw new Error("package.json has no version");
  return match[2];
}

export function setPackageVersion(packageJson: string, version: string): string {
  return replaceOnce(packageJson, PACKAGE_VERSION, version, "package.json version");
}

export function setLockVersion(lock: string, version: string): string {
  return replaceOnce(lock, LOCK_VERSION, version, "bun.lock entry for @tesseract/electron");
}

function replaceOnce(text: string, pattern: RegExp, version: string, what: string): string {
  if (!pattern.test(text)) throw new Error(`missing ${what}`);
  return text.replace(pattern, `$1${version}$3`);
}
