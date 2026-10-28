import { defineGalleryEntry } from "../../app/define";
import { fixtureIssues } from "../../fixtures/projects-issues/data";
import { useBoardDrag } from "../../pages/projects/tabs/issues/hooks/use-board-drag";
import { IssueBoard } from "../../pages/projects/tabs/issues/IssueBoard";
import { issueColumns } from "../../pages/projects/tabs/issues/model";

const noop = () => undefined;
const COLUMNS = issueColumns(fixtureIssues("tesseract"));

function IssueBoardSample() {
  const drag = useBoardDrag(noop);
  return <IssueBoard columns={COLUMNS} drag={drag} onOpen={noop} onCreate={noop} />;
}

export default defineGalleryEntry({
  id: "issues-board",
  title: "Issue board",
  group: "Lists",
  width: 1200,
  render: () => <IssueBoardSample />,
});
