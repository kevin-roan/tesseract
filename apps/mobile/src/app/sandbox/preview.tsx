import { useLocalSearchParams } from "expo-router";
import { GlobeIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import WebSurface from "@/components/web-surface";
import { usePreviewScreen } from "@/features/app-runs/hooks/use-preview-screen";
import { PREVIEW_COPY } from "@/features/app-runs/utils/content";
import { firstParam } from "@/features/sandbox/utils/routes";

export default function PreviewScreen() {
  const params = useLocalSearchParams<{ run?: string; sandbox?: string; title?: string }>();
  const { surfaceRef, ...preview } = usePreviewScreen(
    firstParam(params.run),
    firstParam(params.sandbox),
    firstParam(params.title),
  );

  return (
    <ScreenScaffold
      scroll={false}
      header={
        <ScreenHeader title={preview.title} subtitle={preview.subtitle} onBack={preview.nav.back} actions={preview.headerActions} />
      }
    >
      {preview.loading ? (
        <EmptyState loading title={PREVIEW_COPY.loading} />
      ) : !preview.url || !preview.origin ? (
        <EmptyState icon={GlobeIcon} title={PREVIEW_COPY.invalidTitle} message={PREVIEW_COPY.invalidMessage} />
      ) : preview.error ? (
        <EmptyState
          icon={GlobeIcon}
          title={PREVIEW_COPY.failedTitle}
          message={preview.error}
          actionLabel={PREVIEW_COPY.retry}
          onAction={preview.retry}
        />
      ) : (
        <WebSurface
          key={preview.surfaceKey}
          ref={surfaceRef}
          uri={preview.url}
          allowedOrigin={preview.origin}
          title={preview.title}
          onLoad={preview.onLoad}
          onError={preview.onError}
        />
      )}
    </ScreenScaffold>
  );
}
