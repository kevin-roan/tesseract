import { useLocalSearchParams } from "expo-router";
import { CheckCircleIcon, FolderSimpleIcon, WarningIcon } from "phosphor-react-native";

import ChoiceGroup from "@/components/choice-group";
import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import { SkeletonList } from "@/components/skeleton";
import ProjectFileRow from "@/features/files/components/project-file-row";
import TaildropSheet from "@/features/files/components/taildrop-sheet";
import { useProjectFilesScreen } from "@/features/files/hooks/use-project-files-screen";
import { PROJECT_FILES_COPY } from "@/features/files/utils/project-files";
import { firstParam } from "@/features/sandbox/utils/routes";

export default function ProjectFilesScreen() {
  const params = useLocalSearchParams<{ id: string; path?: string }>();
  const screen = useProjectFilesScreen(firstParam(params.id) ?? "", firstParam(params.path) ?? "");

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      header={<ScreenHeader title={screen.title} subtitle={screen.subtitle} onBack={screen.back} />}
    >
      <ChoiceGroup options={screen.crumbs} selectedId={screen.path} onSelect={screen.open} scrollable label={PROJECT_FILES_COPY.breadcrumbs} />
      {screen.downloadError ? <Notice tone="danger" icon={WarningIcon} message={screen.downloadError} /> : null}
      {screen.sendFailure ? <Notice tone="danger" icon={WarningIcon} message={screen.sendFailure} /> : null}
      {screen.sentMessage ? <Notice tone="success" icon={CheckCircleIcon} message={screen.sentMessage} /> : null}
      {screen.loading ? (
        <SkeletonList count={6} height={64} radius="card" />
      ) : screen.error ? (
        <EmptyState
          icon={FolderSimpleIcon}
          title={PROJECT_FILES_COPY.failedTitle}
          message={screen.error}
          actionLabel={PROJECT_FILES_COPY.retry}
          onAction={screen.retry}
        />
      ) : screen.entries.length === 0 ? (
        <EmptyState icon={FolderSimpleIcon} title={PROJECT_FILES_COPY.empty} />
      ) : (
        <Section title={screen.summary} testID="project-files">
          {screen.truncated ? <Notice message={PROJECT_FILES_COPY.truncated} /> : null}
          {screen.entries.map((file, index) => (
            <ProjectFileRow
              key={file.path}
              index={index}
              file={file}
              local={screen.localStatus(file)}
              onOpen={() => screen.open(file.path)}
              onDownload={() => screen.download(file)}
              onShare={() => screen.share(file)}
              onTaildrop={screen.taildropAvailable ? () => screen.openTaildrop(file) : undefined}
            />
          ))}
        </Section>
      )}
      <TaildropSheet
        fileName={screen.sharing?.name ?? null}
        targets={screen.targets}
        loading={screen.targetsLoading}
        sendingTargetId={screen.sendingTargetId}
        error={screen.sendError}
        onSelect={screen.sendTo}
        onClose={screen.closeTaildrop}
      />
    </ScreenScaffold>
  );
}
