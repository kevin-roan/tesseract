import { CheckCircleIcon, FilesIcon, WarningIcon } from "phosphor-react-native";

import ChoiceGroup from "@/components/choice-group";
import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import Section from "@/components/section";
import SegmentedPills from "@/components/segmented-pills";
import { SkeletonList } from "@/components/skeleton";
import BuildOutputsSection from "@/features/files/components/build-outputs-section";
import FileCard from "@/features/files/components/file-card";
import TaildropSheet from "@/features/files/components/taildrop-sheet";
import { useFilesScreen } from "@/features/files/hooks/use-files-screen";

export default function FilesScreen() {
  const screen = useFilesScreen();

  return (
    <ScreenScaffold
      refreshing={screen.refreshing}
      onRefresh={screen.paired ? screen.refresh : undefined}
      header={<ScreenHeader title="Files" subtitle={screen.subtitle} onBack={screen.back} />}
    >
      {!screen.hydrated ? (
        <SkeletonList count={3} height={120} radius="card" />
      ) : !screen.paired ? (
        <EmptyState
          icon={FilesIcon}
          title="No sandbox paired"
          message="Pair a sandbox to download the files Claude shares and your builds."
          actionLabel="Pair a sandbox"
          onAction={screen.pair}
        />
      ) : (
        <>
          <SegmentedPills options={screen.viewOptions} value={screen.view} onChange={screen.selectView} />
          {screen.view === "builds" ? (
            <BuildOutputsSection builds={screen.builds} projectName={screen.projectName} />
          ) : screen.loading ? (
            <SkeletonList count={3} height={120} radius="card" />
          ) : screen.error ? (
            <Notice tone="danger" icon={WarningIcon} title="Files are unavailable" message={screen.error} actionLabel="Retry" onAction={screen.retry} />
          ) : screen.total === 0 ? (
            <EmptyState
              icon={FilesIcon}
              title="No files yet"
              message="Build artifacts and files Claude shares from the sandbox land here."
            />
          ) : (
            <>
              {screen.downloadError ? <Notice tone="danger" icon={WarningIcon} message={screen.downloadError} /> : null}
              {screen.actionError ? <Notice tone="danger" icon={WarningIcon} message={screen.actionError} /> : null}
              {screen.sentMessage ? <Notice tone="success" icon={CheckCircleIcon} message={screen.sentMessage} /> : null}
              <ChoiceGroup
                options={screen.sourceOptions}
                selectedId={screen.sourceId}
                onSelect={screen.selectSource}
                scrollable
                label="Filter by source"
              />
              {screen.projectOptions.length > 0 ? (
                <ChoiceGroup
                  options={screen.projectOptions}
                  selectedId={screen.projectId}
                  onSelect={screen.selectProject}
                  scrollable
                  label="Filter by project"
                />
              ) : null}
              <Section
                title="Files"
                testID="files-list"
                isEmpty={screen.files.length === 0}
                emptyLabel="No files match these filters."
                emptyActionLabel="Show all files"
                onEmptyAction={screen.clearFilters}
              >
                {screen.files.map((artifact, index) => (
                  <FileCard
                    key={artifact.id}
                    index={index}
                    artifact={artifact}
                    project={screen.projectName(artifact.projectId)}
                    local={screen.localStatus(artifact)}
                    onDownload={() => screen.download(artifact)}
                    onShare={() => screen.share(artifact)}
                    onTaildrop={screen.taildropAvailable ? () => screen.openTaildrop(artifact) : undefined}
                    onDelete={() => screen.remove(artifact)}
                    deleting={screen.deletingId === artifact.id}
                  />
                ))}
              </Section>
            </>
          )}
        </>
      )}
      <TaildropSheet
        fileName={screen.sharing?.fileName ?? null}
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
