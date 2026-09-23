import { DownloadSimpleIcon, PackageIcon } from "phosphor-react-native";
import type { Artifact } from "@theone/protocol";

import ActionButton from "@/components/action-button";
import ResourceCard from "@/components/resource-card";

import { artifactMeta, artifactSubtitle } from "../../utils/describe";

export type ArtifactCardProps = {
  artifact: Artifact;
  onDownload: () => void;
  downloading?: boolean;
};

const ArtifactCard = ({ artifact, onDownload, downloading = false }: ArtifactCardProps) => (
  <ResourceCard
    icon={PackageIcon}
    title={artifact.fileName}
    subtitle={artifactSubtitle(artifact)}
    meta={artifactMeta(artifact)}
    footer={
      <ActionButton
        label="Download"
        icon={DownloadSimpleIcon}
        variant="secondary"
        size="sm"
        loading={downloading}
        onPress={onDownload}
        accessibilityLabel={`Download ${artifact.fileName}`}
      />
    }
  />
);

export default ArtifactCard;
