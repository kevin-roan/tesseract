import { useMemo } from "react";
import { View } from "react-native";
import type { AgentRun } from "@theone/protocol";

import { useAppTheme } from "@/hooks/use-app-theme";
import UploadAttachment from "@/features/attachments/components/upload-attachment";
import VoiceMessage from "@/features/voice/components/voice-message";

import { formatClock, partitionAttachments } from "../../utils/messages";
import MessageBubble from "../message-bubble";
import createStyles from "./styles";

export type RunMessageProps = {
  run: Pick<AgentRun, "prompt" | "attachments" | "startedAt">;
};

const RunMessage = ({ run }: RunMessageProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { audio, images, files } = useMemo(() => partitionAttachments(run.attachments), [run.attachments]);
  const uploads = [...images, ...files];

  return (
    <MessageBubble role="user" text={audio ? undefined : run.prompt} timeLabel={formatClock(run.startedAt)}>
      {uploads.length > 0 ? (
        <View style={styles.attachments}>
          {uploads.map((upload) => (
            <UploadAttachment key={upload.id} upload={upload} large={upload.kind === "image"} />
          ))}
        </View>
      ) : null}
      {audio ? <VoiceMessage upload={audio} transcript={run.prompt} /> : null}
    </MessageBubble>
  );
};

export default RunMessage;
