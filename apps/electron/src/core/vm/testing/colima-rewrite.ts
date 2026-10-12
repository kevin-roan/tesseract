import { parse, stringify } from "yaml";

export function colimaRewrite(text: string): string {
  const data = parse(text) as Record<string, unknown>;
  const kept = Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== false || key === "hostname"));
  return stringify({
    ...kept,
    hostname: "colima-tesseract",
    rootDisk: 20,
    cpuType: "",
    sshPort: 51022,
    modelRunner: "docker",
    network: { ...(data.network as object), gatewayAddress: "192.168.5.2" },
  });
}
