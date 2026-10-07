import type { Upload } from "@theone/protocol";
import { AttachmentChip } from "../../../components/Composer";
import { formatBytes } from "./run-info";
import { useUploadThumbnail } from "./use-upload-thumbnail";

function UploadChip({ upload }: { upload: Upload }) {
  const thumbnail = useUploadThumbnail(upload);
  return (
    <AttachmentChip
      name={upload.name}
      kind={upload.kind}
      meta={formatBytes(upload.sizeBytes)}
      thumbnailUrl={thumbnail}
      large={upload.kind === "image"}
    />
  );
}

export interface UploadChipsProps {
  uploads: readonly Upload[];
}

export function UploadChips({ uploads }: UploadChipsProps) {
  return (
    <>
      {uploads.map((upload) => (
        <UploadChip key={upload.id} upload={upload} />
      ))}
    </>
  );
}
