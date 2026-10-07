import { describe, expect, it } from "vitest";
import {
  appleScriptString,
  groupCommand,
  linuxFamily,
  linuxInstallSteps,
  macInstallScript,
  manualLinuxCommands,
  osascriptAdminArgs,
  osascriptOutcome,
  pkexecOutcome,
  powershellElevated,
  shellQuote,
  windowsOutcome,
} from "./elevate";
import { parseOsRelease } from "./parse";
import { OS_RELEASE_ARCH, OS_RELEASE_UBUNTU, OS_RELEASE_VOID } from "./testing/fixtures";

const result = (code: number | null, stderr = "", stdout = "") => ({ code, stderr, stdout, timedOut: false });

describe("quoting", () => {
  it("quotes for sh, AppleScript and PowerShell", () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
    expect(appleScriptString(`a "b" \\c`)).toBe(`"a \\"b\\" \\\\c"`);
    expect(powershellElevated("C:\\Docker Installer.exe", ["install", "--quiet"])).toEqual([
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$p = Start-Process -Verb RunAs -Wait -PassThru -FilePath 'C:\\Docker Installer.exe' -ArgumentList 'install','--quiet'; exit $p.ExitCode",
    ]);
  });

  it("builds the macOS admin install script", () => {
    const script = macInstallScript("/Users/o'neil/Docker.dmg", "/tmp/m", "o'neil");
    expect(script).toBe(
      `hdiutil attach -nobrowse -quiet -mountpoint '/tmp/m' '/Users/o'\\''neil/Docker.dmg' && '/tmp/m/Docker.app/Contents/MacOS/install' --accept-license --user='o'\\''neil'; s=$?; hdiutil detach -quiet '/tmp/m'; exit $s`,
    );
    expect(osascriptAdminArgs("echo hi")).toEqual(["-e", `do shell script "echo hi" with administrator privileges`]);
  });
});

describe("linux install plans", () => {
  it("picks the install family from os-release", () => {
    expect(linuxFamily(parseOsRelease(OS_RELEASE_UBUNTU))).toBe("convenience");
    expect(linuxFamily(parseOsRelease(OS_RELEASE_ARCH))).toBe("arch");
    expect(linuxFamily(parseOsRelease("ID=opensuse-tumbleweed\nID_LIKE=\"opensuse suse\""))).toBe("suse");
    expect(linuxFamily(parseOsRelease("ID=linuxmint\nID_LIKE=\"ubuntu debian\""))).toBe("convenience");
    expect(linuxFamily(parseOsRelease(OS_RELEASE_VOID))).toBe("manual");
  });

  it("runs install, enable and usermod in one elevated shell", () => {
    expect(linuxInstallSteps("convenience", "dev", "/data/get-docker.sh").join(" && ")).toBe(
      "sh '/data/get-docker.sh' && systemctl enable --now docker.service && usermod -aG docker 'dev'",
    );
    expect(linuxInstallSteps("arch", "dev", "")[0]).toBe("pacman -S --needed --noconfirm docker docker-compose docker-buildx");
    expect(linuxInstallSteps("manual", "dev", "")).toEqual([]);
    expect(groupCommand("kvm", "dev")).toBe("getent group kvm >/dev/null || groupadd kvm; usermod -aG kvm 'dev'");
  });

  it("prints sudo commands for the manual path", () => {
    expect(manualLinuxCommands("manual", "dev")).toEqual([
      "curl -fsSL https://get.docker.com -o get-docker.sh",
      "sudo sh get-docker.sh",
      "sudo systemctl enable --now docker.service",
      "sudo usermod -aG docker 'dev'",
    ]);
  });
});

describe("elevation outcomes", () => {
  it("maps pkexec exit codes", () => {
    expect(pkexecOutcome(result(0))).toBe("ok");
    expect(pkexecOutcome(result(126))).toBe("cancelled");
    expect(pkexecOutcome(result(127))).toBe("no-agent");
    expect(pkexecOutcome(result(1, "Error executing command as another user: No authentication agent found."))).toBe("no-agent");
    expect(pkexecOutcome(result(1, "E: Unable to locate package"))).toBe("failed");
  });

  it("maps osascript and Windows installer results", () => {
    expect(osascriptOutcome(result(1, "execution error: User canceled. (-128)"))).toBe("cancelled");
    expect(osascriptOutcome(result(1, "boom"))).toBe("failed");
    expect(windowsOutcome(result(3010))).toBe("reboot");
    expect(windowsOutcome(result(0, "", "Installation succeeded. Please restart your computer."))).toBe("reboot");
    expect(windowsOutcome(result(1, "Start-Process : This command cannot be run due to the error: The operation was canceled by the user."))).toBe("cancelled");
    expect(windowsOutcome(result(0))).toBe("ok");
    expect(windowsOutcome(result(5))).toBe("failed");
  });
});
