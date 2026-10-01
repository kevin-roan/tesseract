import { ArrowSquareOutIcon, GlobeIcon } from "phosphor-react-native";
import type { ListeningPort } from "@theone/protocol";

import ActionButton from "@/components/action-button";
import ResourceCard from "@/components/resource-card";
import { ThemedText } from "@/components/themed-text";

import { siteLabel, siteUrl } from "../../utils/sites";

export type WebLinkCardProps = {
  site: ListeningPort;
  onOpen?: (url: string) => void;
  onPress?: () => void;
};

const WebLinkCard = ({ site, onOpen, onPress }: WebLinkCardProps) => {
  const url = siteUrl(site);
  const label = siteLabel(site);

  return (
    <ResourceCard
      icon={GlobeIcon}
      title={label}
      subtitle={site.command}
      monospaceSubtitle
      onPress={onPress}
      footer={
        url && onOpen ? (
          <ActionButton
            label="Open in browser"
            icon={ArrowSquareOutIcon}
            variant="secondary"
            size="sm"
            onPress={() => onOpen(url)}
            accessibilityLabel={`Open ${label} in browser`}
          />
        ) : undefined
      }
    >
      {url ? (
        <ThemedText variant="code" selectable>
          {url}
        </ThemedText>
      ) : (
        <ThemedText variant="caption" color="textTertiary">
          No Tailscale IP yet, so this site can't be reached from your phone.
        </ThemedText>
      )}
    </ResourceCard>
  );
};

export default WebLinkCard;
