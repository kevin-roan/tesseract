import { File, Paths } from "expo-file-system";

export function readBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}

export function writeCacheFile(name: string, base64: string): string {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(base64, { encoding: "base64" });
  return file.uri;
}

export function fileSize(uri: string): number | null {
  try {
    const file = new File(uri);
    return file.exists ? file.size : null;
  } catch {
    return null;
  }
}
