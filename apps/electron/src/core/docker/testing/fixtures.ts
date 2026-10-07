export const VERSION_JSON_ENGINE = "{\"Client\":{\"Version\":\"29.8.1\",\"ApiVersion\":\"1.56\",\"DefaultAPIVersion\":\"1.56\",\"GitCommit\":\"4a63305d74\",\"GoVersion\":\"go1.27.1-X:nodwarf5\",\"Os\":\"linux\",\"Arch\":\"amd64\",\"BuildTime\":\"Fri Sep 18 15:27:28 2026\",\"Context\":\"default\"},\"Server\":{\"Platform\":{\"Name\":\"\"},\"Version\":\"29.8.1\",\"ApiVersion\":\"1.56\",\"MinAPIVersion\":\"1.40\",\"Os\":\"linux\",\"Arch\":\"amd64\",\"Components\":[{\"Name\":\"Engine\",\"Version\":\"29.8.1\",\"Details\":{\"ApiVersion\":\"1.56\",\"Arch\":\"amd64\",\"BuildTime\":\"Fri Sep 18 15:27:28 2026\",\"Experimental\":\"false\",\"GitCommit\":\"464cd50c3d\",\"GoVersion\":\"go1.27.1-X:nodwarf5\",\"KernelVersion\":\"7.2.7-zen1-1-zen\",\"MinAPIVersion\":\"1.40\",\"Module\":\"github.com/moby/moby/v2\",\"ModuleVersion\":\"v2.0.0+unknown\",\"Os\":\"linux\"}},{\"Name\":\"containerd\",\"Version\":\"v2.4.1\",\"Details\":{\"GitCommit\":\"f2551031d7276a770f65f98c9b52e57e7dad07e8.m\"}},{\"Name\":\"runc\",\"Version\":\"1.5.2\",\"Details\":{\"GitCommit\":\"\"}},{\"Name\":\"docker-init\",\"Version\":\"0.19.0\",\"Details\":{\"GitCommit\":\"de40ad0\"}}],\"GitCommit\":\"464cd50c3d\",\"GoVersion\":\"go1.27.1-X:nodwarf5\",\"KernelVersion\":\"7.2.7-zen1-1-zen\",\"BuildTime\":\"2026-09-18T15:27:28.000000000+00:00\"}}";

export const VERSION_JSON_NO_SERVER =
  '{"Client":{"Version":"29.8.1","ApiVersion":"1.56","Os":"linux","Arch":"amd64","Context":"default"},"Server":null}';

export const INFO_JSON_ENGINE = "{\"OperatingSystem\": \"Arch Linux\", \"SecurityOptions\": [\"name=seccomp,profile=builtin\", \"name=cgroupns\"], \"NCPU\": 16, \"MemTotal\": 20562128896, \"DockerRootDir\": \"/var/lib/docker\", \"ServerVersion\": \"29.8.1\", \"OSType\": \"linux\", \"Architecture\": \"x86_64\", \"ClientInfo\": {\"Context\": \"default\", \"Plugins\": [{\"Name\": \"buildx\", \"Version\": \"v0.35.0\"}, {\"Name\": \"compose\", \"Version\": \"5.5.1\"}]}}";

export const INFO_JSON_DESKTOP = JSON.stringify({
  OperatingSystem: "Docker Desktop",
  SecurityOptions: ["name=seccomp,profile=unconfined", "name=cgroupns"],
  NCPU: 8,
  MemTotal: 6 * 1024 ** 3,
  DockerRootDir: "/var/lib/docker",
  ServerVersion: "28.4.0",
  ClientInfo: { Context: "desktop-linux", Plugins: [{ Name: "buildx", Version: "v0.28.0-desktop.1" }, { Name: "compose", Version: "v2.39.2-desktop.1" }] },
});

export const INFO_JSON_ROOTLESS = JSON.stringify({
  OperatingSystem: "Ubuntu 24.04 LTS",
  SecurityOptions: ["name=seccomp,profile=builtin", "name=rootless", "name=cgroupns"],
  NCPU: 4,
  MemTotal: 16 * 1024 ** 3,
  DockerRootDir: "/home/dev/.local/share/docker",
  ServerVersion: "27.3.1",
  ClientInfo: { Context: "rootless", Plugins: [{ Name: "buildx", Version: "v0.17.1" }, { Name: "compose", Version: "v2.29.7" }] },
});

export const CLI_VERSION = "Docker version 29.8.1, build 4a63305d74";
export const PODMAN_VERSION = "podman version 5.2.3";

export const PERMISSION_ERROR =
  "permission denied while trying to connect to the docker API at unix:///var/run/docker.sock";
export const STOPPED_ERROR =
  "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?";
export const WINDOWS_STOPPED_ERROR =
  "error during connect: Get \"http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.47/version\": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.";

export const OS_RELEASE_UBUNTU = `PRETTY_NAME="Ubuntu 24.04.1 LTS"
NAME="Ubuntu"
VERSION_ID="24.04"
ID=ubuntu
ID_LIKE=debian
`;

export const OS_RELEASE_ARCH = `NAME="Arch Linux"
PRETTY_NAME="Arch Linux"
ID=arch
BUILD_ID=rolling
`;

export const OS_RELEASE_VOID = `NAME="Void"
ID="void"
PRETTY_NAME="Void Linux"
`;

export const MAC_CHECKSUMS = "02147e4d559ff41e1d9d7be63a554101340237064c7b6df234548aa111ebf04c *Docker.dmg\n";
export const WIN_CHECKSUMS = "a9814e31049d66156477a86614e83365669677733014ec72f74229623ff3890a *Docker Desktop Installer.exe\n";

export const APPCAST = `<?xml version="1.0"?><rss><channel><item>
<sparkle:shortVersionString>4.48.0</sparkle:shortVersionString>
<sparkle:minimumSystemVersion>14.0.0</sparkle:minimumSystemVersion>
</item></channel></rss>`;

export function utf16(text: string): string {
  return Buffer.from(text, "utf16le").toString("latin1");
}
