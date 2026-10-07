import { useMemo, type ReactNode } from "react";
import { View } from "react-native";
import { FolderSimpleIcon, InfoIcon } from "phosphor-react-native";
import { LIMITS } from "@theone/protocol";

import Chip from "@/components/chip";
import MenuSheet from "@/components/menu-sheet";
import Notice from "@/components/notice";
import OptionSheet from "@/components/option-sheet";
import { useAppTheme } from "@/hooks/use-app-theme";
import AttachmentTray from "@/features/attachments/components/attachment-tray";
import RecordingBar from "@/features/voice/components/recording-bar";

import type { ChatComposerState } from "../../hooks/use-chat-composer";
import ComposerBar from "../composer-bar";
import ModePill from "../mode-pill";
import NewProjectSheet from "../new-project-sheet";
import createStyles from "./styles";

export type ChatComposerProps = {
  composer: ChatComposerState;
  placeholder: string;
  noProjectLabel?: string;
  transcribingLabel?: string;
  dismissLabel?: string;
  banner?: ReactNode;
  testID?: string;
};

const ChatComposer = ({
  composer,
  placeholder,
  noProjectLabel = "No project",
  transcribingLabel = "Transcribing…",
  dismissLabel = "Dismiss",
  banner,
  testID,
}: ChatComposerProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { voice, attachments, mode, project, clipboard } = composer;
  const recording = voice.phase === "recording";
  const idle = voice.phase === "idle";

  const replacement =
    voice.phase === "idle" ? null : (
      <RecordingBar
        phase={voice.phase}
        levels={voice.levels}
        elapsedLabel={voice.elapsedLabel}
        statusLabel={transcribingLabel}
        error={voice.error}
        onCancel={recording ? voice.cancel : voice.discard}
        onFinish={voice.stop}
        onRetry={voice.retry}
      />
    );

  return (
    <View style={styles.container} testID={testID}>
      {composer.error ? (
        <Notice tone="danger" message={composer.error} actionLabel={dismissLabel} onAction={composer.dismissError} />
      ) : null}
      {composer.notice && !composer.error ? (
        <Notice
          tone="info"
          icon={InfoIcon}
          message={composer.notice}
          actionLabel={dismissLabel}
          onAction={composer.dismissNotice}
        />
      ) : null}
      <ComposerBar
        value={composer.text}
        onChangeText={composer.setText}
        onFocus={clipboard.onFocus}
        onBlur={clipboard.onBlur}
        placeholder={placeholder}
        maxLength={LIMITS.maxPromptLength}
        primary={composer.primary}
        onPrimary={composer.primary === "send" ? composer.send : composer.startVoice}
        primaryDisabled={composer.locked || (composer.primary === "send" && !composer.canSend)}
        busy={composer.sending}
        onMic={composer.startVoice}
        micDisabled={composer.sending || composer.locked}
        banner={idle ? banner : null}
        onAttach={() => composer.openSheet("attach")}
        attachDisabled={!composer.attach.enabled || composer.sending}
        toolbar={
          project && idle ? (
            <Chip
              label={project.label ?? noProjectLabel}
              icon={FolderSimpleIcon}
              selected={project.id !== null}
              variant="ghost"
              onPress={() => composer.openSheet("project")}
            />
          ) : null
        }
        chips={
          idle ? (
            <ModePill
              label={mode.label}
              detail={mode.detail}
              accessibilityHint={mode.sheet.title}
              onPress={() => composer.openSheet("mode")}
            />
          ) : null
        }
        accessory={
          idle ? (
            <AttachmentTray
              items={attachments.items}
              onRemove={attachments.remove}
              onRetry={attachments.retry}
              onPaste={clipboard.canPaste ? clipboard.paste : undefined}
            />
          ) : null
        }
        replacement={replacement}
      />
      <OptionSheet
        visible={composer.sheet === "mode"}
        title={mode.sheet.title}
        footnote={mode.sheet.footnote}
        options={mode.options}
        selectedId={mode.id}
        onSelect={mode.select}
        onClose={composer.closeSheet}
      />
      <MenuSheet
        visible={composer.sheet === "attach"}
        title="Attach"
        options={composer.attach.options}
        onSelect={composer.attach.select}
        onClose={composer.closeSheet}
        onDismissed={composer.onSheetDismissed}
      />
      {project ? (
        <MenuSheet
          visible={composer.sheet === "project"}
          title="Project"
          options={project.options}
          selectedId={project.id}
          onSelect={project.select}
          onClose={composer.closeSheet}
        />
      ) : null}
      <NewProjectSheet state={composer.newProject} />
    </View>
  );
};

export default ChatComposer;
