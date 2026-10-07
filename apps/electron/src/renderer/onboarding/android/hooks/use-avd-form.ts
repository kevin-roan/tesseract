import { useMemo, useState } from "react";
import type { AvdDeviceProfile, AvdInfo, SystemImageOption } from "../../../../shared/contracts/android";
import { DEFAULT_DEVICE, STORAGE_GB } from "../constants";
import { defaultAvdName, defaultCores, defaultMemoryMb, validateAvdName, type AvdForm } from "../model";

export interface AvdFormState {
  form: AvdForm;
  nameError: string | null;
  setName(name: string): void;
  setImage(path: string): void;
  setDevice(id: AvdDeviceProfile): void;
  setRamMb(value: number): void;
  setCores(value: number): void;
  setStorageGb(value: number): void;
}

type Edits = Partial<AvdForm>;

export function useAvdForm(
  images: readonly SystemImageOption[],
  selected: ReadonlySet<string>,
  existing: readonly AvdInfo[],
  host: { memBytes: number; cpus: number } | null,
): AvdFormState {
  const [edits, setEdits] = useState<Edits>({});
  const edit = (patch: Edits) => setEdits((current) => ({ ...current, ...patch }));

  const form = useMemo<AvdForm>(() => {
    const chosen = images.filter((image) => selected.has(image.path));
    const image = edits.image && selected.has(edits.image) ? edits.image : (chosen[0]?.path ?? null);
    const api = images.find((option) => option.path === image)?.api ?? null;
    return {
      name: edits.name ?? defaultAvdName(api),
      image,
      device: edits.device ?? DEFAULT_DEVICE,
      ramMb: edits.ramMb ?? defaultMemoryMb(host?.memBytes ?? null),
      cores: edits.cores ?? defaultCores(host?.cpus ?? null),
      storageGb: edits.storageGb ?? STORAGE_GB.default,
    };
  }, [edits, host, images, selected]);

  const nameError = form.image ? validateAvdName(form.name, existing) : null;

  return {
    form,
    nameError,
    setName: (name) => edit({ name }),
    setImage: (image) => edit({ image }),
    setDevice: (device) => edit({ device }),
    setRamMb: (ramMb) => edit({ ramMb }),
    setCores: (cores) => edit({ cores }),
    setStorageGb: (storageGb) => edit({ storageGb }),
  };
}
