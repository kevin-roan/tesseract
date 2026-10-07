import type { GitCommit, GitDetails, GitFileStatus, Project } from "@theone/protocol";
import { useMemo } from "react";
import { describeError } from "../../../../app/connection";
import { ListGroup } from "../../../../components/GroupBand";
import { KeyedList } from "../../../../components/KeyedList";
import { Notice } from "../../../../components/Notice";
import { RecordRow } from "../../../../components/RecordRow";
import { Reveal } from "../../../../components/Reveal";
import { TabStack } from "../kit";
import { GIT_LABELS } from "./labels";
import { commitMeta, commitTitle, gitFileCode, gitFileKind, gitFileTone, gitTabView } from "./model";

export interface GitTabProps {
  project: Project | null;
  details: GitDetails | null;
  error?: unknown;
}

const fileKey = (file: GitFileStatus) => file.path;
const commitKey = (commit: GitCommit) => commit.sha;

const renderFile = (file: GitFileStatus) => (
  <RecordRow title={file.path} monospaceTitle code={gitFileCode(file)} codeTone={gitFileTone(file)} meta={gitFileKind(file)} />
);

const renderCommit = (commit: GitCommit) => <RecordRow icon="commit" title={commitTitle(commit)} meta={commitMeta(commit)} />;

export function GitTab({ project, details, error = null }: GitTabProps) {
  const message = error === null || error === undefined ? null : describeError(error);
  const view = useMemo(() => gitTabView(project, details, message), [project, details, message]);
  return (
    <TabStack>
      <Reveal open={view.notice !== null}>
        {view.notice ? <Notice message={view.notice.message} tone={view.notice.tone} /> : null}
      </Reveal>
      {view.hasGit ? (
        <>
          <ListGroup
            icon="branch"
            title={GIT_LABELS.files}
            count={details ? view.files.length : null}
            subtitle={view.subtitle}
            loading={view.loading}
            empty={details !== null && view.files.length === 0}
            emptyLabel={GIT_LABELS.filesEmpty}
          >
            <KeyedList items={view.files} getKey={fileKey} renderItem={renderFile} divided label={GIT_LABELS.filesList} />
          </ListGroup>
          <ListGroup
            icon="commit"
            title={GIT_LABELS.log}
            count={details ? view.commits.length : null}
            loading={view.loading}
            empty={details !== null && view.commits.length === 0}
            emptyLabel={GIT_LABELS.logEmpty}
          >
            <KeyedList items={view.commits} getKey={commitKey} renderItem={renderCommit} divided label={GIT_LABELS.logList} />
          </ListGroup>
        </>
      ) : null}
    </TabStack>
  );
}
