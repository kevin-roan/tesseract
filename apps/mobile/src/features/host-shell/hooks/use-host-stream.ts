import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_ANDROID_STREAM, type AndroidStreamSettings, type UpdateAndroidStream } from "@tesseract/protocol";

import type { MenuOption } from "@/components/menu-sheet/types";

import { hostKeys } from "../api/query-keys";
import { useHostSessionStore } from "../store/host-session-store";
import { STREAM_BIT_RATE_MBIT } from "../utils/constants";
import { HOST_LOCKED, STREAM_COPY } from "../utils/content";
import { describeHostError, isSessionLost } from "../utils/errors";
import {
  encodingLabel,
  encodingOptions,
  fromMbit,
  maxSizeId,
  maxSizeLabel,
  maxSizeOptions,
  maxSizeValue,
  STREAM_RANGES,
  streamChanges,
  streamDeviceId,
  streamDeviceLabel,
  streamDeviceOptions,
  streamDeviceValue,
  toMbit,
} from "../utils/stream";
import { useHostClient } from "./use-host-client";
import { useHostNavigation } from "./use-host-navigation";

type StreamSheet = "device" | "encoding" | "maxSize";

export function useHostStream() {
  const nav = useHostNavigation();
  const queryClient = useQueryClient();
  const { host, hydrated, session, sessionClient } = useHostClient();
  const clear = useHostSessionStore((state) => state.clear);
  const [draft, setDraft] = useState<UpdateAndroidStream>({});
  const [sheet, setSheet] = useState<StreamSheet | null>(null);
  const scope = host && session ? ([host.baseUrl, session.session] as const) : null;
  const settingsKey = scope ? hostKeys.stream(...scope) : hostKeys.root;

  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: ({ signal }) => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.androidStreamSettings({ signal });
    },
    enabled: sessionClient !== null,
  });

  const devices = useQuery({
    queryKey: scope ? hostKeys.devices(...scope) : hostKeys.root,
    queryFn: ({ signal }) => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.androidDevices({ signal });
    },
    enabled: sessionClient !== null,
  });

  const save = useMutation({
    mutationFn: (change: UpdateAndroidStream) => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.updateAndroidStream(change);
    },
    onSuccess: (next) => {
      queryClient.setQueryData<AndroidStreamSettings>(settingsKey, next);
      setDraft({});
      if (scope) void queryClient.invalidateQueries({ queryKey: hostKeys.android(...scope) });
    },
  });

  const failure = save.error ?? settings.error ?? devices.error;

  useEffect(() => {
    if (isSessionLost(failure)) clear();
  }, [failure, clear]);

  const { setup } = nav;
  useEffect(() => {
    if (hydrated && !session) setup();
  }, [hydrated, session, setup]);

  const saved = settings.data;
  const values: AndroidStreamSettings = { ...(saved ?? DEFAULT_ANDROID_STREAM), ...draft };
  const changes = saved ? streamChanges(saved, draft) : {};
  const dirty = Object.keys(changes).length > 0;
  const deviceList = useMemo(() => devices.data ?? [], [devices.data]);

  const change = (fields: UpdateAndroidStream) => {
    save.reset();
    setDraft((current) => ({ ...current, ...fields }));
  };

  const sheets = useMemo<Record<StreamSheet, { title: string; options: MenuOption[]; footnote?: string }>>(
    () => ({
      device: {
        title: STREAM_COPY.deviceSheetTitle,
        options: streamDeviceOptions(deviceList, saved?.device ?? null),
        footnote: STREAM_COPY.deviceFootnote,
      },
      encoding: { title: STREAM_COPY.encodingSheetTitle, options: encodingOptions() },
      maxSize: { title: STREAM_COPY.maxSizeSheetTitle, options: maxSizeOptions() },
    }),
    [deviceList, saved?.device],
  );

  const selectedIds: Record<StreamSheet, string> = {
    device: streamDeviceId(values.device),
    encoding: values.encoding,
    maxSize: maxSizeId(values.maxSize),
  };

  const select = (id: string) => {
    if (sheet === "device") change({ device: streamDeviceValue(id) });
    if (sheet === "encoding") change({ encoding: id as AndroidStreamSettings["encoding"] });
    if (sheet === "maxSize") change({ maxSize: maxSizeValue(id) });
    setSheet(null);
  };

  return {
    nav,
    loading: settings.isLoading,
    ready: saved !== undefined,
    error: failure ? describeHostError(failure) : null,
    refresh: () => {
      void settings.refetch();
      void devices.refetch();
    },
    refreshing: settings.isRefetching || devices.isRefetching,
    device: { label: streamDeviceLabel(deviceList, values.device), open: () => setSheet("device") },
    encoding: { label: encodingLabel(values.encoding), open: () => setSheet("encoding") },
    maxSize: { label: maxSizeLabel(values.maxSize), open: () => setSheet("maxSize") },
    bitRate: {
      value: toMbit(values.bitRate),
      ...STREAM_BIT_RATE_MBIT,
      format: STREAM_COPY.bitRateValue,
      onChange: (mbit: number) => change({ bitRate: fromMbit(mbit) }),
    },
    maxFps: { value: values.maxFps, ...STREAM_RANGES.maxFps, onChange: (maxFps: number) => change({ maxFps }) },
    keyFrameInterval: {
      value: values.keyFrameInterval,
      ...STREAM_RANGES.keyFrameInterval,
      onChange: (keyFrameInterval: number) => change({ keyFrameInterval }),
    },
    jpegQuality: {
      value: values.jpegQuality,
      ...STREAM_RANGES.jpegQuality,
      onChange: (jpegQuality: number) => change({ jpegQuality }),
    },
    sheet: {
      visible: sheet !== null,
      ...sheets[sheet ?? "device"],
      selectedId: selectedIds[sheet ?? "device"],
      select,
      close: () => setSheet(null),
    },
    dirty,
    saving: save.isPending,
    saved: save.isSuccess && !dirty,
    save: () => {
      if (dirty) save.mutate(changes);
    },
    reset: () => change({ ...DEFAULT_ANDROID_STREAM }),
  };
}

export type HostStreamState = ReturnType<typeof useHostStream>;
