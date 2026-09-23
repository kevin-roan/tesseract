import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";

export type RegularFile = { content: string; sizeBytes: number; truncated: boolean };

export type ReadRegularFileOptions = {
  maxBytes: number;
  followSymlinks?: boolean;
  truncate?: boolean;
};

/**
 * Reads at most `maxBytes` of a regular file. Devices, FIFOs, sockets and directories
 * yield null without blocking (O_NONBLOCK, checked on the open descriptor, so a swap
 * after a stat cannot redirect the read). Larger files yield null unless `truncate` is set.
 */
export function readRegularFile(path: string, options: ReadRegularFileOptions): RegularFile | null {
  const flags = constants.O_RDONLY | constants.O_NONBLOCK | (options.followSymlinks ? 0 : constants.O_NOFOLLOW);
  let fd: number;
  try {
    fd = openSync(path, flags);
  } catch {
    return null;
  }
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile()) return null;
    const truncated = stats.size > options.maxBytes;
    if (truncated && !options.truncate) return null;
    const buffer = Buffer.alloc(Math.min(stats.size, options.maxBytes));
    let offset = 0;
    while (offset < buffer.length) {
      const read = readSync(fd, buffer, offset, buffer.length - offset, offset);
      if (read === 0) break;
      offset += read;
    }
    const content = new TextDecoder().decode(buffer.subarray(0, offset), { stream: truncated });
    return { content, sizeBytes: stats.size, truncated };
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}
