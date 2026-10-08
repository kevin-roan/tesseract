import { fireEvent, render, screen } from "@testing-library/react-native";
import { SparkleIcon } from "phosphor-react-native";
import { sampleAgentRun, sampleUpload } from "@tesseract/protocol/fixtures";

import MenuSheet from "@/components/menu-sheet";
import Waveform from "@/components/waveform";
import AttachmentChip from "@/features/attachments/components/attachment-chip";
import AttachmentTray from "@/features/attachments/components/attachment-tray";
import ChatComposer from "@/features/chat/components/chat-composer";
import ComposerBar from "@/features/chat/components/composer-bar";
import { greetingTitle } from "@/features/chat/utils/suggestions";
import MessageBubble from "@/features/chat/components/message-bubble";
import RunMessage from "@/features/chat/components/run-message";
import RecordingBar from "@/features/voice/components/recording-bar";
import VoiceBubble from "@/features/voice/components/voice-bubble";

import { chatComposerState } from "./fixtures";

jest.mock("@/features/attachments/hooks/use-upload-source", () => ({
  useUploadSource: () => ({ uri: "http://sandbox/upload", headers: { Authorization: "Bearer t" } }),
}));

const mockPlayback = {
  playing: false,
  loading: false,
  progress: 0,
  levels: [0.2, 0.4],
  durationLabel: "0:30",
  error: null,
  toggle: jest.fn(),
};
jest.mock("@/features/voice/hooks/use-voice-playback", () => ({ useVoicePlayback: () => mockPlayback }));

const isDisabled = (label: string) => screen.getByLabelText(label).props.accessibilityState?.disabled;

describe("<ComposerBar />", () => {
  const base = { value: "", onChangeText: jest.fn(), placeholder: "Message", onPrimary: jest.fn() };

  it("shows a mic for an empty draft and forwards typing and attach", async () => {
    const onAttach = jest.fn();
    await render(<ComposerBar {...base} primary="mic" onAttach={onAttach} />);
    await fireEvent.changeText(screen.getByLabelText("Message"), "hello");
    expect(base.onChangeText).toHaveBeenCalledWith("hello");
    await fireEvent.press(screen.getByLabelText("Record voice message"));
    expect(base.onPrimary).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Attach"));
    expect(onAttach).toHaveBeenCalled();
  });

  it("disables send until allowed and swaps the row for a replacement", async () => {
    await render(<ComposerBar {...base} primary="send" primaryDisabled />);
    expect(isDisabled("Send")).toBe(true);
    await render(<ComposerBar {...base} primary="send" replacement={<MessageBubble role="user" text="recording" />} />);
    expect(screen.queryByLabelText("Message")).toBeNull();
    expect(screen.getByText("recording")).toBeOnTheScreen();
  });
});

describe("<ChatComposer />", () => {
  it("wires the toolbar, errors and the recording bar", async () => {
    const composer = chatComposerState({ error: "Too big", voice: { phase: "failed", error: "STT is off", elapsedLabel: "0:04" } });
    await render(<ChatComposer composer={composer} placeholder="Message" />);
    expect(screen.getByText("Too big")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(composer.dismissError).toHaveBeenCalled();
    expect(screen.getByText("STT is off")).toBeOnTheScreen();
    expect(screen.getByText("0:04")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Retry voice message"));
    expect(composer.voice.retry).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Discard recording"));
    expect(composer.voice.discard).toHaveBeenCalled();
  });

  it("asks whether a new chat gets a project and what to call it", async () => {
    const composer = chatComposerState({ newProject: { visible: true, name: "my-site", hint: "Created as /workspace/projects/my-site" } });
    await render(<ChatComposer composer={composer} placeholder="Message" />);
    expect(screen.getByText("Created as /workspace/projects/my-site")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByDisplayValue("my-site"), "blog");
    expect(composer.newProject.setName).toHaveBeenCalledWith("blog");
    await fireEvent.press(screen.getByText("Create project"));
    expect(composer.newProject.create).toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Chat without a project"));
    expect(composer.newProject.skip).toHaveBeenCalled();
  });

  it("shows a dismissible transcription notice", async () => {
    const composer = chatComposerState({ notice: "Gemini unavailable — used native transcription: quota" });
    await render(<ChatComposer composer={composer} placeholder="Message" />);
    expect(screen.getByText("Gemini unavailable — used native transcription: quota")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(composer.dismissNotice).toHaveBeenCalled();
  });

  it("starts voice from the mic and lists draft attachments", async () => {
    const composer = chatComposerState({
      attachments: {
        items: [
          {
            key: "k1",
            uri: "file:///a.pdf",
            name: "a.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
            kind: "pdf",
            status: "error",
            upload: null,
            error: "Upload failed",
          },
        ],
      },
    });
    await render(<ChatComposer composer={composer} placeholder="Message" />);
    await fireEvent.press(screen.getByLabelText("Record voice message"));
    expect(composer.startVoice).toHaveBeenCalled();
    expect(screen.getByText("Upload failed")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Retry a.pdf"));
    expect(composer.attachments.retry).toHaveBeenCalledWith("k1");
    await fireEvent.press(screen.getByLabelText("Remove a.pdf"));
    expect(composer.attachments.remove).toHaveBeenCalledWith("k1");
  });
});

describe("<RecordingBar />", () => {
  it("cancels or finishes while recording and shows transcription progress", async () => {
    const props = { levels: [0.1, 0.5], elapsedLabel: "0:12", onCancel: jest.fn(), onFinish: jest.fn(), onRetry: jest.fn() };
    await render(<RecordingBar phase="recording" {...props} />);
    await fireEvent.press(screen.getByLabelText("Cancel recording"));
    expect(props.onCancel).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Finish recording"));
    expect(props.onFinish).toHaveBeenCalled();

    await render(<RecordingBar phase="transcribing" statusLabel="Transcribing…" {...props} />);
    expect(screen.getByText("Transcribing…")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Finish recording")).toBeNull();
  });
});

describe("<VoiceBubble /> and <Waveform />", () => {
  it("toggles playback and shows the duration", async () => {
    const onToggle = jest.fn();
    await render(<VoiceBubble playing={false} levels={[0.3, 0.6]} progress={0.5} durationLabel="0:30" onToggle={onToggle} />);
    expect(screen.getByText("0:30")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Play voice message"));
    expect(onToggle).toHaveBeenCalled();
    await render(<VoiceBubble playing levels={[]} progress={0} durationLabel={null} onToggle={onToggle} />);
    expect(screen.getByLabelText("Pause voice message")).toBeOnTheScreen();
  });

  it("renders one dash column per level", async () => {
    const { toJSON } = await render(<Waveform levels={[0.1, 0.2, 0.3]} progress={0.34} />);
    const tree = toJSON();
    expect(Array.isArray(tree) ? null : tree?.children).toHaveLength(3);
  });
});

describe("<MessageBubble />", () => {
  it("renders user text and an assistant header", async () => {
    await render(<MessageBubble role="user" text="Fix the build" timeLabel="11:28am" />);
    expect(screen.getByText("Fix the build")).toBeOnTheScreen();
    await render(<MessageBubble role="assistant" author="Claude" timeLabel="11:29am" text="On it." />);
    expect(screen.getByText("Claude")).toBeOnTheScreen();
    expect(screen.getByText("11:29am")).toBeOnTheScreen();
    await render(<MessageBubble role="assistant" author="Claude" showHeader={false} text="More." />);
    expect(screen.queryByText("Claude")).toBeNull();
  });
});

describe("<RunMessage />", () => {
  it("shows a text prompt with its attachments", async () => {
    await render(<RunMessage run={sampleAgentRun} />);
    expect(screen.getByText(sampleAgentRun.prompt)).toBeOnTheScreen();
    expect(screen.getByLabelText(sampleUpload.name)).toBeOnTheScreen();
  });

  it("shows a voice prompt as a playable bubble with its transcript", async () => {
    const audio = { ...sampleUpload, id: "upl_voice00001", kind: "audio" as const, name: "voice.m4a", mimeType: "audio/mp4" };
    await render(<RunMessage run={{ ...sampleAgentRun, attachments: [audio] }} />);
    expect(screen.getByText(sampleAgentRun.prompt)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Play voice message"));
    expect(mockPlayback.toggle).toHaveBeenCalled();
    expect(screen.queryByLabelText("voice.m4a")).toBeNull();
  });
});

describe("<AttachmentTray /> and <AttachmentChip />", () => {
  it("renders nothing without items and chips with state", async () => {
    const { toJSON } = await render(<AttachmentTray items={[]} onRemove={jest.fn()} onRetry={jest.fn()} />);
    expect(toJSON()).toBeNull();
    await render(<AttachmentChip name="shot.png" kind="image" thumbnailUri="file:///shot.png" status="uploading" onRemove={jest.fn()} />);
    expect(screen.getByLabelText("shot.png")).toBeOnTheScreen();
    expect(screen.getByLabelText("Remove shot.png")).toBeOnTheScreen();
  });
});

describe("<MenuSheet />", () => {
  it("lists options, marks the selected one and reports choices", async () => {
    const onSelect = jest.fn();
    await render(
      <MenuSheet
        visible
        title="Permission mode"
        options={[
          { id: "plan", label: "Plan", description: "Read-only", icon: SparkleIcon },
          { id: "bypassPermissions", label: "Auto" },
        ]}
        selectedId="plan"
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText("Permission mode")).toBeOnTheScreen();
    expect(screen.getByLabelText("Plan").props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByLabelText("Auto"));
    expect(onSelect).toHaveBeenCalledWith("bypassPermissions");
  });
});

describe("greetingTitle", () => {
  it("greets by first name and falls back without one", () => {
    expect(greetingTitle("Ada Lovelace")).toBe("Hello, Ada\nHow can I help you?");
    expect(greetingTitle(null)).toBe("Hello\nHow can I help you?");
  });
});
