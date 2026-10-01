import type { RefObject } from "react";
import { PlugsIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import WebSurface, { type WebSurfaceHandle } from "@/components/web-surface";

import { describeError } from "../../utils/errors";

export type RemoteSurfaceProps = {
  title: string;
  url: string | null;
  origin: string | null;
  isLoading: boolean;
  error: Error | null;
  surfaceRef: RefObject<WebSurfaceHandle | null>;
  onMessage: (data: string) => void;
  onLoad: () => void;
  onError: () => void;
  onTerminate: () => void;
  onReconnect: () => void;
};

const RemoteSurface = ({
  title,
  url,
  origin,
  isLoading,
  error,
  surfaceRef,
  onMessage,
  onLoad,
  onError,
  onTerminate,
  onReconnect,
}: RemoteSurfaceProps) => {
  if (url && origin) {
    return (
      <WebSurface
        ref={surfaceRef}
        uri={url}
        allowedOrigin={origin}
        title={title}
        onMessage={onMessage}
        onLoad={onLoad}
        onError={onError}
        onTerminate={onTerminate}
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={PlugsIcon}
        title={`Couldn't open the ${title.toLowerCase()}`}
        message={describeError(error)}
        actionLabel="Try again"
        onAction={onReconnect}
      />
    );
  }

  return <EmptyState loading={isLoading} title={`Opening the ${title.toLowerCase()}…`} />;
};

export default RemoteSurface;
