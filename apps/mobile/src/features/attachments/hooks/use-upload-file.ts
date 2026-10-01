import { useCallback } from "react";
import { LIMITS, type Upload } from "@theone/protocol";

import { useCreateUpload } from "@/features/sandbox/hooks/use-sandbox-mutations";

import { fileSize, readBase64 } from "../services/read-file";
import type { PickedFile } from "../types";
import { MAX_UPLOAD_BYTES } from "../utils/constants";
import { decodedLength, tooLargeMessage } from "../utils/files";

export function useUploadFile() {
  const { mutateAsync } = useCreateUpload();

  return useCallback(
    async (file: PickedFile): Promise<Upload> => {
      const size = file.sizeBytes ?? fileSize(file.uri);
      if (size !== null && size > MAX_UPLOAD_BYTES) throw new Error(tooLargeMessage(file.name));
      const data = await readBase64(file.uri);
      if (decodedLength(data) > MAX_UPLOAD_BYTES) throw new Error(tooLargeMessage(file.name));
      return mutateAsync({ name: file.name.slice(0, LIMITS.maxUploadNameLength), mimeType: file.mimeType, data });
    },
    [mutateAsync],
  );
}
