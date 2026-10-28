import { useLocalSearchParams } from "expo-router";

import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import EmptyState from "@/components/empty-state";
import HostStream from "@/features/host-shell/components/host-stream";
import HostStreamActions from "@/features/host-shell/components/host-stream-actions";
import { useHostStream } from "@/features/host-shell/hooks/use-host-stream";
import { STREAM_COPY } from "@/features/host-shell/utils/content";
import { streamKindFrom } from "@/features/host-shell/utils/stream";

export default function HostStreamScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const stream = useHostStream(streamKindFrom(kind));

  return (
    <ScreenScaffold
      refreshing={stream.refreshing}
      onRefresh={stream.refresh}
      header={<ScreenHeader title={STREAM_COPY.title} subtitle={stream.subtitle} onBack={stream.nav.back} />}
      footer={
        <HostStreamActions
          resetLabel={STREAM_COPY.reset}
          saveLabel={STREAM_COPY.save}
          onReset={stream.reset}
          onSave={stream.save}
          canSave={stream.dirty}
          saving={stream.saving}
          disabled={!stream.ready}
        />
      }
    >
      {stream.loading ? <EmptyState loading title={STREAM_COPY.title} /> : null}
      <HostStream stream={stream} />
    </ScreenScaffold>
  );
}
