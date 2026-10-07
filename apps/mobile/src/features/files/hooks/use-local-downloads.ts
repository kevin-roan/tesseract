import { useCallback, useRef, useState } from "react";

import { downloadFile, isDownloaded, shareFile, type LocalFileRef } from "../services/local-files";
import { describeFileError } from "../utils/errors";

export type LocalDownload = {
  key: string;
  ref: LocalFileRef;
  resolveUrl: () => Promise<string>;
};

export type LocalFileStatus = {
  downloaded: boolean;
  /** Fraction in [0, 1] while downloading, `null` when the size is unknown, `undefined` when idle. */
  progress: number | null | undefined;
  sharing: boolean;
};

/** Downloads files into app storage and hands them to the system share sheet. */
export function useLocalDownloads() {
  const [progress, setProgress] = useState<Readonly<Record<string, number | null>>>({});
  const [sharingKey, setSharingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(new Map<string, Promise<void>>());
  const sharing = useRef(false);

  const fetchFile = useCallback((item: LocalDownload): Promise<void> => {
    const running = active.current.get(item.key);
    if (running) return running;
    setError(null);
    setProgress((current) => ({ ...current, [item.key]: 0 }));
    let percent = 0;
    const update = (fraction: number | null) => {
      const next = fraction === null ? -1 : Math.floor(fraction * 100);
      if (next === percent) return;
      percent = next;
      setProgress((current) => (item.key in current ? { ...current, [item.key]: fraction } : current));
    };
    const job = item
      .resolveUrl()
      .then((url) => downloadFile(url, item.ref, update))
      .then(() => undefined)
      .finally(() => {
        active.current.delete(item.key);
        setProgress(({ [item.key]: _done, ...rest }) => rest);
      });
    active.current.set(item.key, job);
    return job;
  }, []);

  const download = useCallback(
    (item: LocalDownload) => {
      fetchFile(item).catch((cause: unknown) => setError(describeFileError(cause)));
    },
    [fetchFile],
  );

  const share = useCallback(
    async (item: LocalDownload) => {
      if (sharing.current) return;
      sharing.current = true;
      setError(null);
      setSharingKey(item.key);
      try {
        if (!isDownloaded(item.ref)) await fetchFile(item);
        await shareFile(item.ref);
      } catch (cause) {
        setError(describeFileError(cause));
      } finally {
        sharing.current = false;
        setSharingKey(null);
      }
    },
    [fetchFile],
  );

  const status = (item: LocalDownload): LocalFileStatus => ({
    downloaded: !(item.key in progress) && isDownloaded(item.ref),
    progress: progress[item.key],
    sharing: sharingKey === item.key,
  });

  return {
    download,
    share: (item: LocalDownload) => void share(item),
    status,
    error,
    showError: setError,
  };
}
