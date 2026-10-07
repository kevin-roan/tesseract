import { PackageIcon, WarningIcon } from "phosphor-react-native";

import ChoiceGroup from "@/components/choice-group";
import EmptyState from "@/components/empty-state";
import Notice from "@/components/notice";
import Section from "@/components/section";
import { SkeletonList } from "@/components/skeleton";

import type { useBuildOutputs } from "../../hooks/use-build-outputs";
import { buildOutputKey } from "../../utils/build-outputs";
import BuildOutputCard from "../build-output-card";

export type BuildOutputsSectionProps = {
  builds: ReturnType<typeof useBuildOutputs>;
  projectName: (projectId: string) => string | null;
};

const BuildOutputsSection = ({ builds, projectName }: BuildOutputsSectionProps) => {
  if (builds.loading) return <SkeletonList count={3} height={120} radius="card" />;
  if (builds.error) {
    return <Notice tone="danger" icon={WarningIcon} title="Builds are unavailable" message={builds.error} actionLabel="Retry" onAction={builds.retry} />;
  }
  if (builds.total === 0) {
    return (
      <EmptyState
        icon={PackageIcon}
        title="No builds found"
        message="APKs, AABs, installers and AppImages in your projects' build, dist, release and out folders show up here."
      />
    );
  }

  return (
    <>
      {builds.downloadError ? <Notice tone="danger" icon={WarningIcon} message={builds.downloadError} /> : null}
      {builds.projectOptions.length > 0 ? (
        <ChoiceGroup
          options={builds.projectOptions}
          selectedId={builds.projectId}
          onSelect={builds.selectProject}
          scrollable
          label="Filter by project"
        />
      ) : null}
      <Section
        title="Project builds"
        testID="build-outputs-list"
        isEmpty={builds.outputs.length === 0}
        emptyLabel="No builds match this project."
        emptyActionLabel="Show all builds"
        onEmptyAction={builds.clearFilters}
      >
        {builds.outputs.map((output, index) => (
          <BuildOutputCard
            key={buildOutputKey(output)}
            index={index}
            output={output}
            project={projectName(output.projectId)}
            local={builds.localStatus(output)}
            onDownload={() => builds.download(output)}
            onShare={() => builds.share(output)}
          />
        ))}
      </Section>
    </>
  );
};

export default BuildOutputsSection;
