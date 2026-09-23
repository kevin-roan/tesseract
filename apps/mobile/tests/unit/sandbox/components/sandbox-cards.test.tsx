import { createRef } from "react";
import { Linking } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { AgentRunEvent, GitDetails } from "@theone/protocol";
import {
  sampleAgentRun,
  sampleArtifact,
  sampleBuild,
  sampleGitDetails,
  sampleProcess,
  sampleProject,
  sampleTerminal,
} from "@theone/protocol/fixtures";

import type { WebSurfaceHandle } from "@/components/web-surface";
import AgentComposer from "@/features/sandbox/components/agent-composer";
import AgentEvent from "@/features/sandbox/components/agent-event";
import AgentRunCard from "@/features/sandbox/components/agent-run-card";
import ArtifactCard from "@/features/sandbox/components/artifact-card";
import BuildCard from "@/features/sandbox/components/build-card";
import BuildTargetCard from "@/features/sandbox/components/build-target-card";
import CloneProgress from "@/features/sandbox/components/clone-progress";
import GitCard from "@/features/sandbox/components/git-card";
import PairingForm from "@/features/sandbox/components/pairing-form";
import ProcessCard from "@/features/sandbox/components/process-card";
import ProjectForm from "@/features/sandbox/components/project-form";
import QrScanner from "@/features/sandbox/components/qr-scanner";
import RemoteSurface from "@/features/sandbox/components/remote-surface";
import ScriptCard from "@/features/sandbox/components/script-card";
import TerminalCard from "@/features/sandbox/components/terminal-card";
import { buildTargetOptions, terminalKindLabel } from "@/features/sandbox/utils/labels";
import { EMPTY_PAIRING_DRAFT } from "@/features/sandbox/utils/pairing";
import { EMPTY_PROJECT_DRAFT } from "@/features/sandbox/utils/new-project";

jest.mock("@/components/glass", () => {
  const { Pressable, View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { GlassSurface: View, GlassPill: View, GlassButton: Pressable };
});

const TS = "2026-09-23T10:00:00.000Z";
const isBusy = (label: string) => screen.getByLabelText(label).props.accessibilityState?.busy;
const isDisabled = (label: string) => screen.getByLabelText(label).props.accessibilityState?.disabled;

describe("<AgentEvent />", () => {
  const cases: [AgentRunEvent, string[]][] = [
    [{ kind: "text", seq: 1, ts: TS, text: "Starting the build." }, ["Starting the build."]],
    [{ kind: "tool_use", seq: 2, ts: TS, tool: "Bash", summary: "npm test" }, ["Bash", "npm test"]],
    [{ kind: "tool_result", seq: 3, ts: TS, tool: "Bash", isError: false, summary: "ok" }, ["Bash", "ok"]],
    [{ kind: "tool_result", seq: 4, ts: TS, tool: null, isError: true, summary: "exit 1" }, ["exit 1"]],
    [{ kind: "system", seq: 0, ts: TS, text: "session started" }, ["session started"]],
  ];

  it.each(cases)("renders %p", async (event, texts) => {
    await render(<AgentEvent event={event} />);
    for (const text of texts) expect(screen.getByText(text)).toBeOnTheScreen();
  });
});

describe("<AgentComposer />", () => {
  const base = {
    prompt: "",
    onChangePrompt: jest.fn(),
    onSubmit: jest.fn(),
    canSubmit: false,
    submitting: false,
    submitLabel: "Start run",
    placeholder: "Describe the task",
  };

  it("disables submit until allowed and forwards typing", async () => {
    await render(<AgentComposer {...base} />);
    expect(isDisabled("Start run")).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Prompt"), "build it");
    expect(base.onChangePrompt).toHaveBeenCalledWith("build it");
    expect(screen.queryByLabelText("Project for this run")).toBeNull();
  });

  it("offers project choices and shows errors", async () => {
    const onToggleProject = jest.fn();
    await render(
      <AgentComposer
        {...base}
        canSubmit
        error="Claude is busy"
        projects={[{ id: "a", label: "Alpha" }]}
        projectId="a"
        onToggleProject={onToggleProject}
      />,
    );
    await fireEvent.press(screen.getByLabelText("Alpha"));
    expect(onToggleProject).toHaveBeenCalledWith("a");
    expect(screen.getByLabelText("Alpha").props.accessibilityState.selected).toBe(true);
    expect(screen.getByText("Claude is busy")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Start run"));
    expect(base.onSubmit).toHaveBeenCalled();
  });
});

describe("resource cards", () => {
  it("renders an agent run with its outcome", async () => {
    const onPress = jest.fn();
    await render(<AgentRunCard run={{ ...sampleAgentRun, state: "failed", error: "Out of budget" }} onPress={onPress} />);
    expect(screen.getByText("Out of budget")).toBeOnTheScreen();
    expect(screen.getByText("Failed")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders an artifact with a download button", async () => {
    const onDownload = jest.fn();
    await render(<ArtifactCard artifact={sampleArtifact} onDownload={onDownload} />);
    await fireEvent.press(screen.getByLabelText(`Download ${sampleArtifact.fileName}`));
    expect(onDownload).toHaveBeenCalled();
    expect(isBusy(`Download ${sampleArtifact.fileName}`)).toBe(false);

    await render(<ArtifactCard artifact={sampleArtifact} onDownload={onDownload} downloading />);
    expect(isBusy(`Download ${sampleArtifact.fileName}`)).toBe(true);
  });

  it("shows build progress only while a build is active", async () => {
    await render(<BuildCard build={sampleBuild} />);
    expect(screen.queryByLabelText("Build progress")).toBeNull();

    await render(<BuildCard build={{ ...sampleBuild, state: "running", progress: 0.5, endedAt: null }} />);
    expect(screen.getByLabelText("Build progress")).toBeOnTheScreen();
  });

  it("builds a target with the chosen profile", async () => {
    const onBuild = jest.fn();
    const [option] = buildTargetOptions(["electron-windows"]);
    await render(<BuildTargetCard option={option} onBuild={onBuild} />);

    await fireEvent.press(screen.getByLabelText(`Build ${option.label}`));
    await fireEvent.press(screen.getByLabelText("Release"));
    await fireEvent.press(screen.getByLabelText(`Build ${option.label}`));
    expect(onBuild.mock.calls).toEqual([["debug"], ["release"]]);
  });

  it("offers stop and logs on an active process", async () => {
    const onStop = jest.fn();
    const onToggleLogs = jest.fn();
    await render(<ProcessCard process={sampleProcess} onStop={onStop} onToggleLogs={onToggleLogs} logsOpen />);

    await fireEvent.press(screen.getByLabelText(`Stop ${sampleProcess.name}`));
    await fireEvent.press(screen.getByLabelText("Hide logs"));
    expect(onStop).toHaveBeenCalled();
    expect(onToggleLogs).toHaveBeenCalled();
    expect(screen.getByText(sampleProcess.command as string)).toBeOnTheScreen();
  });

  it("hides stop on a finished process and the footer when there is nothing to do", async () => {
    await render(<ProcessCard process={{ ...sampleProcess, state: "exited", exitCode: 0 }} onStop={jest.fn()} onToggleLogs={jest.fn()} />);
    expect(screen.queryByLabelText(`Stop ${sampleProcess.name}`)).toBeNull();
    expect(screen.getByLabelText("Logs")).toBeOnTheScreen();

    await render(<ProcessCard process={{ ...sampleProcess, state: "exited", exitCode: 0 }} onStop={jest.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("runs a script on the display when chosen", async () => {
    const onRun = jest.fn();
    await render(<ScriptCard script="start" command="npm run start" preferDisplay={false} onRun={onRun} />);

    await fireEvent.press(screen.getByLabelText("Run start"));
    await fireEvent.press(screen.getByLabelText("Show on display"));
    await fireEvent.press(screen.getByLabelText("Run start"));
    expect(onRun.mock.calls).toEqual([[false], [true]]);
  });

  it("renders shell and Claude terminals and closes only running ones", async () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    await render(<TerminalCard terminal={sampleTerminal} onOpen={onOpen} onClose={onClose} />);
    await fireEvent.press(screen.getByLabelText("Close session"));
    expect(onClose).toHaveBeenCalled();

    await render(<TerminalCard terminal={{ ...sampleTerminal, kind: "claude", title: "", state: "exited" }} onOpen={onOpen} onClose={onClose} />);
    expect(screen.getByText(terminalKindLabel("claude"))).toBeOnTheScreen();
    expect(screen.queryByLabelText("Close session")).toBeNull();
    await fireEvent.press(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe("<GitCard />", () => {
  const manyFiles: GitDetails = {
    ...sampleGitDetails,
    files: Array.from({ length: 5 }, (_, index) => ({ path: `src/file-${index}.ts`, index: " ", worktree: "M" })),
    log: [
      { sha: "aaaaaaaaaaaa", subject: "one", author: "dev", date: TS },
      { sha: "bbbbbbbbbbbb", subject: "two", author: "dev", date: TS },
    ],
  };

  it("lists capped files and commits", async () => {
    await render(
      <GitCard summary={{ ...sampleProject.git!, dirty: true }} details={manyFiles} fileLimit={3} commitLimit={1} />,
    );
    expect(screen.getByText("src/file-2.ts")).toBeOnTheScreen();
    expect(screen.queryByText("src/file-3.ts")).toBeNull();
    expect(screen.getByText("+ 2 more files")).toBeOnTheScreen();
    expect(screen.getByText("one")).toBeOnTheScreen();
    expect(screen.queryByText("two")).toBeNull();
    expect(screen.getByText("5 changes")).toBeOnTheScreen();
  });

  it("falls back to the details branch and to no branch", async () => {
    await render(<GitCard summary={null} details={sampleGitDetails} fileLimit={8} commitLimit={3} />);
    expect(screen.getByText("main")).toBeOnTheScreen();
    expect(screen.queryByText(/more file/)).toBeNull();

    await render(<GitCard summary={null} details={undefined} fileLimit={8} commitLimit={3} />);
    expect(screen.getByText("No branch")).toBeOnTheScreen();
  });
});

describe("forms", () => {
  it("edits and submits the pairing form, locking it while validating", async () => {
    const onChange = jest.fn();
    const onSubmit = jest.fn();
    await render(
      <PairingForm
        draft={EMPTY_PAIRING_DRAFT}
        errors={{ token: "Enter the pairing token." }}
        message="Can't reach the sandbox."
        status="idle"
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    );
    await fireEvent.changeText(screen.getByLabelText("Controller URL"), "http://127.0.0.1:7700");
    await fireEvent.changeText(screen.getByLabelText("Token"), "tok");
    await fireEvent.changeText(screen.getByLabelText("Name (optional)"), "Box");
    await fireEvent(screen.getByLabelText("Name (optional)"), "submitEditing");
    await fireEvent.press(screen.getByLabelText("Pair sandbox"));

    expect(onChange.mock.calls).toEqual([
      ["url", "http://127.0.0.1:7700"],
      ["token", "tok"],
      ["name", "Box"],
    ]);
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Enter the pairing token.")).toBeOnTheScreen();
    expect(screen.getByText("Can't reach the sandbox.")).toBeOnTheScreen();

    await render(
      <PairingForm draft={EMPTY_PAIRING_DRAFT} errors={{}} message={null} status="validating" onChange={onChange} onSubmit={onSubmit} />,
    );
    expect(screen.getByLabelText("Token").props.editable).toBe(false);
    expect(isBusy("Pair sandbox")).toBe(true);
  });

  it("edits every project field", async () => {
    const onChange = jest.fn();
    await render(
      <ProjectForm
        draft={EMPTY_PROJECT_DRAFT}
        errors={{ gitUrl: "Bad URL" }}
        locationHint="hint"
        submitLabel="Clone"
        submitting={false}
        error={null}
        onChange={onChange}
        onSubmit={jest.fn()}
      />,
    );
    await fireEvent.changeText(screen.getByLabelText("Name"), "app");
    await fireEvent.changeText(screen.getByLabelText("Git URL (optional)"), "https://x/y.git");
    await fireEvent.changeText(screen.getByLabelText("Branch (optional)"), "dev");
    expect(onChange.mock.calls).toEqual([
      ["name", "app"],
      ["gitUrl", "https://x/y.git"],
      ["branch", "dev"],
    ]);
    expect(screen.getByText("Bad URL")).toBeOnTheScreen();
  });
});

describe("<CloneProgress />", () => {
  it("shows the failure with a way into the project", async () => {
    const onOpenProject = jest.fn();
    await render(<CloneProgress lines={[]} emptyLabel="Cloning…" failure="git exited with 128" onOpenProject={onOpenProject} />);
    await fireEvent.press(screen.getByLabelText("Open project"));
    expect(onOpenProject).toHaveBeenCalled();
    expect(screen.getByText("Cloning…")).toBeOnTheScreen();
  });
});

describe("<QrScanner />", () => {
  const base = { onRequestPermission: jest.fn(), onScanned: jest.fn(), paused: false };

  it("shows the camera once granted and pauses scanning", async () => {
    const onRescan = jest.fn();
    await render(<QrScanner {...base} permission="granted" onRescan={onRescan} />);
    expect(screen.getByTestId("camera").props.onBarcodeScanned).toBe(base.onScanned);
    await fireEvent.press(screen.getByLabelText("Scan again"));
    expect(onRescan).toHaveBeenCalled();

    await render(<QrScanner {...base} permission="granted" paused />);
    expect(screen.getByTestId("camera").props.onBarcodeScanned).toBeUndefined();
    expect(screen.queryByLabelText("Scan again")).toBeNull();
  });

  it("waits, asks, or points to settings depending on the permission", async () => {
    await render(<QrScanner {...base} permission="unknown" />);
    expect(screen.queryByTestId("camera")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();

    await render(<QrScanner {...base} permission="prompt" />);
    await fireEvent.press(screen.getByLabelText("Allow camera"));
    expect(base.onRequestPermission).toHaveBeenCalled();

    const openSettings = jest.spyOn(Linking, "openSettings").mockRejectedValue(new Error("unsupported"));
    await render(<QrScanner {...base} permission="blocked" />);
    expect(screen.getByText(/Camera access is turned off/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Open Settings"));
    expect(openSettings).toHaveBeenCalled();
    openSettings.mockRestore();
  });
});

describe("<RemoteSurface />", () => {
  const base = {
    title: "Terminal",
    url: null,
    origin: null,
    isLoading: true,
    error: null,
    surfaceRef: createRef<WebSurfaceHandle>(),
    onMessage: jest.fn(),
    onLoad: jest.fn(),
    onError: jest.fn(),
    onReconnect: jest.fn(),
  };

  it("shows a loading state until the URL arrives", async () => {
    await render(<RemoteSurface {...base} />);
    expect(screen.getByText("Opening the terminal…")).toBeOnTheScreen();
  });

  it("offers a retry when the URL cannot be fetched", async () => {
    await render(<RemoteSurface {...base} isLoading={false} error={new Error("ticket refused")} />);
    expect(screen.getByText("Couldn't open the terminal")).toBeOnTheScreen();
    expect(screen.getByText("ticket refused")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Try again"));
    expect(base.onReconnect).toHaveBeenCalled();
  });

  it("hosts the page pinned to the sandbox origin", async () => {
    await render(<RemoteSurface {...base} url="http://127.0.0.1:7700/ui/terminal#t" origin="http://127.0.0.1:7700" />);
    const web = screen.getByTestId("webview");
    expect(web.props.accessibilityHint).toBe("http://127.0.0.1:7700/ui/terminal#t");
    expect(web.props.originWhitelist).toEqual(["http://127.0.0.1:7700"]);
  });
});
