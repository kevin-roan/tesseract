import { WarningIcon } from "phosphor-react-native";

import MotionItem from "@/components/motion-item";
import Notice from "@/components/notice";

import type { IssueNotice } from "../../types";

export type SandboxNoticesProps = {
  missingToken: boolean;
  onPair: () => void;
  issue: IssueNotice | null;
  onRepair: () => void;
  error?: string | null;
  onRetry?: () => void;
};

const SandboxNotices = ({ missingToken, onPair, issue, onRepair, error, onRetry }: SandboxNoticesProps) => (
  <>
    {missingToken ? (
      <MotionItem>
        <Notice
          tone="warning"
          icon={WarningIcon}
          title="Token missing"
          message="This device no longer has the token for this sandbox. Pair it again."
          actionLabel="Pair"
          onAction={onPair}
        />
      </MotionItem>
    ) : null}
    {issue ? (
      <MotionItem>
        <Notice
          tone="danger"
          icon={WarningIcon}
          title={issue.title}
          message={issue.message}
          actionLabel={issue.actionLabel}
          onAction={onRepair}
        />
      </MotionItem>
    ) : null}
    {error ? (
      <MotionItem>
        <Notice tone="danger" icon={WarningIcon} message={error} actionLabel={onRetry ? "Retry" : undefined} onAction={onRetry} />
      </MotionItem>
    ) : null}
  </>
);

export default SandboxNotices;
