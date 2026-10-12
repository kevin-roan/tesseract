import { describe, expect, it } from "vitest";
import { colimaConfig, colimaConfigPath, configSize, isManagedConfig, resolveSize, sameManagedConfig, vmArch, vmMounts } from "./config";
import { sysboxProvisionScript } from "./provision";
import { colimaRewrite } from "./testing/colima-rewrite";

const INPUT = {
  arch: "aarch64" as const,
  size: resolveSize(),
  home: "/Users/dev",
  resourcesDir: "/Applications/Tesseract.app/Contents/Resources/sandbox",
};

describe("colimaConfig", () => {
  it("is deterministic and carries the managed marker", () => {
    const text = colimaConfig(INPUT);
    expect(colimaConfig(INPUT)).toBe(text);
    expect(isManagedConfig(text)).toBe(true);
    expect(isManagedConfig("cpu: 2\n")).toBe(false);
  });

  it("recognises its config by the marker in the provision script, not the header comment", () => {
    const text = colimaConfig(INPUT);
    expect(sysboxProvisionScript()).toContain("tesseract-managed");
    const rewritten = colimaRewrite(text);
    expect(rewritten).not.toContain("# Written by Tesseract");
    expect(rewritten).toContain("hostname: colima-tesseract");
    expect(rewritten).toContain("modelRunner: docker");
    expect(isManagedConfig(rewritten)).toBe(true);
    expect(isManagedConfig("# tesseract-managed\ncpu: 2\n")).toBe(false);
    expect(isManagedConfig("cpu: [\n")).toBe(false);
  });

  it("treats a colima rewrite of the same settings as current", () => {
    const text = colimaConfig(INPUT);
    expect(sameManagedConfig(colimaRewrite(text), text)).toBe(true);
    expect(sameManagedConfig(colimaRewrite(colimaConfig({ ...INPUT, size: resolveSize({ cpus: 4 }) })), text)).toBe(false);
    expect(sameManagedConfig(colimaRewrite(colimaConfig({ ...INPUT, resourcesDir: "/opt/sandbox" })), text)).toBe(false);
    expect(sameManagedConfig(text.replace("sshConfig: false", "sshConfig: true"), text)).toBe(false);
    expect(sameManagedConfig(text.replace("--retry-connrefused ", ""), text)).toBe(false);
    expect(sameManagedConfig("cpu: [\n", text)).toBe(false);
  });

  it("keeps Colima away from ~/.ssh/config", () => {
    expect(colimaConfig(INPUT)).toContain("sshConfig: false");
  });

  it("sizes and configures the VM for Sysbox", () => {
    const text = colimaConfig(INPUT);
    for (const line of [
      "cpu: 6",
      "memory: 5",
      "disk: 120",
      "arch: aarch64",
      "runtime: docker",
      "vmType: vz",
      "mountType: virtiofs",
      "rosetta: true",
      "binfmt: true",
      "  runtimes:\n    sysbox-runc:\n      path: /usr/bin/sysbox-runc",
      "  - mode: system\n    script: |\n      #!/bin/sh\n",
    ]) {
      expect(text).toContain(line);
    }
  });

  it("disables rosetta on Intel and applies a custom size", () => {
    const text = colimaConfig({ ...INPUT, arch: vmArch("x64"), size: resolveSize({ cpus: 4, memoryGb: 3 }) });
    expect(text).toContain("arch: x86_64");
    expect(text).toContain("rosetta: false");
    expect(configSize(text)).toEqual({ cpus: 4, memoryGb: 3, diskGb: 120 });
  });

  it("mounts home writable and the resources dir read-only when outside home", () => {
    expect(vmMounts("/Users/dev", INPUT.resourcesDir)).toEqual([
      { location: "/Users/dev", writable: true },
      { location: INPUT.resourcesDir, writable: false },
    ]);
    expect(vmMounts("/Users/dev", "/Users/dev/src/tesseract")).toEqual([{ location: "/Users/dev", writable: true }]);
    expect(vmMounts("/Users/dev", "/Users/devops/sandbox")).toHaveLength(2);
    expect(colimaConfig(INPUT)).toContain(`  - location: "${INPUT.resourcesDir}"\n    writable: false`);
  });

  it("finds the profile config under COLIMA_HOME or ~/.colima", () => {
    expect(colimaConfigPath({}, "/Users/dev")).toBe("/Users/dev/.colima/tesseract/colima.yaml");
    expect(colimaConfigPath({ COLIMA_HOME: "/opt/colima" }, "/Users/dev")).toBe("/opt/colima/tesseract/colima.yaml");
  });

  it("reads the size back, defaulting when absent", () => {
    expect(configSize(null)).toEqual({ cpus: 6, memoryGb: 5, diskGb: 120 });
    expect(configSize(colimaConfig(INPUT))).toEqual({ cpus: 6, memoryGb: 5, diskGb: 120 });
  });
});

describe("sysboxProvisionScript", () => {
  it("pins both packages with checksums and stays idempotent", () => {
    const script = sysboxProvisionScript();
    expect(script.startsWith("#!/bin/sh\n")).toBe(true);
    expect(script).toContain("tesseract-managed");
    expect(script).toContain("if [ -x /usr/bin/sysbox-runc ] && sysbox_active; then\n  exit 0");
    expect(script).toContain("sysbox-ce_0.7.1-0.linux_arm64.deb");
    expect(script).toContain("sysbox-ce_0.7.1-0.linux_amd64.deb");
    expect(script).toContain('sha256sum -c -');
    expect(script).toContain('apt-get install -y "$deb"');
    expect(script).toContain("systemctl enable --now sysbox-mgr sysbox-fs");
    expect(script).not.toContain("\t");
  });

  it("waits for guest DNS and retries downloads", () => {
    const script = sysboxProvisionScript();
    expect(script.indexOf("until getent hosts downloads.nestybox.com")).toBeGreaterThan(-1);
    expect(script.indexOf("until getent hosts downloads.nestybox.com")).toBeLessThan(script.indexOf("until apt-get update"));
    expect(script).toContain('if [ "$n" -ge 60 ]');
    expect(script).toContain("--retry-connrefused --retry-delay 2");
  });

  it("leaves restarting docker to the sysbox-ce package", () => {
    const script = sysboxProvisionScript();
    expect(script).not.toContain("installed");
    expect(script).not.toContain("restart docker");
    expect(script.trimEnd().endsWith("systemctl enable --now sysbox-mgr sysbox-fs")).toBe(true);
  });
});
