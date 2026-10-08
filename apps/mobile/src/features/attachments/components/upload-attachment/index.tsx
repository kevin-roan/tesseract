import type { Upload } from "@tesseract/protocol";

import { useUploadSource } from "../../hooks/use-upload-source";
import { formatBytes } from "../../utils/files";
import AttachmentChip from "../attachment-chip";

export type UploadAttachmentProps = {
  upload: Upload;
  large?: boolean;
  onPress?: () => void;
};

const UploadAttachment = ({ upload, large, onPress }: UploadAttachmentProps) => {
  const source = useUploadSource(upload.id, upload.kind === "image");

  return (
    <AttachmentChip
      name={upload.name}
      kind={upload.kind}
      thumbnailUri={source?.uri}
      thumbnailHeaders={source?.headers}
      meta={formatBytes(upload.sizeBytes)}
      large={large}
      onPress={onPress}
    />
  );
};

export default UploadAttachment;
