import { fireEvent, render, screen } from "@testing-library/react-native";
import { FileTextIcon, FolderIcon, PlusIcon } from "phosphor-react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ActionCard from "@/components/action-card";
import ActionRow from "@/components/action-row";
import ActivityItem, { ActivityList } from "@/components/activity-item";
import AiFab from "@/components/ai-fab";
import AvatarStack from "@/components/avatar-stack";
import ChoiceGroup from "@/components/choice-group";
import ConnectionDot from "@/components/connection-dot";
import EmptyState from "@/components/empty-state";
import HomeHeader from "@/components/home-header";
import KeyValueRow from "@/components/key-value-row";
import ListCard from "@/components/list-card";
import Notice from "@/components/notice";
import ProfileHero from "@/components/profile-hero";
import ProgressBar from "@/components/progress-bar";
import ProgressRing from "@/components/progress-ring";
import ProjectCard from "@/components/project-card";
import ScreenHeader from "@/components/screen-header";
import StatCard from "@/components/stat-card";
import StatGrid from "@/components/stat-grid";
import TextField from "@/components/text-field";

const people = [
  { id: "ada", name: "Ada Lovelace" },
  { id: "grace", name: "grace  hopper", photo: "https://example.com/g.png" },
  { id: "alan", name: "Alan" },
  { id: "kat", name: "Katherine Johnson" },
];

describe("<ActionCard /> and <ActionRow />", () => {
  it("renders tiles and presses them", async () => {
    const onPress = jest.fn();
    await render(
      <ActionRow
        items={[
          { id: "a", icon: PlusIcon, label: "Create", tone: "yellow", onPress },
          { id: "b", icon: FileTextIcon, label: "Templates" },
        ]}
      />,
    );
    expect(screen.getByText("Templates")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Create"));
    expect(onPress).toHaveBeenCalled();

    expect(screen.getByRole("button", { name: "Templates" })).toBeDisabled();

    await render(<ActionRow columns={1} items={[]} />);
    await render(<ActionCard icon={PlusIcon} label="Solo" />);
    expect(screen.getByText("Solo")).toBeOnTheScreen();
  });
});

describe("<AvatarStack />", () => {
  it("shows initials or photos and collapses the overflow", async () => {
    await render(<AvatarStack people={people} />);
    expect(screen.getByText("AL")).toBeOnTheScreen();
    expect(screen.getByText("A")).toBeOnTheScreen();
    expect(screen.getByText("+1")).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        "Ada Lovelace, grace  hopper, Alan, Katherine Johnson",
      ),
    ).toBeOnTheScreen();

    await render(<AvatarStack people={people.slice(0, 2)} max={5} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });
});

describe("<ActivityItem />", () => {
  it("renders the entry with metrics and is pressable", async () => {
    const onPress = jest.fn();
    await render(
      <ActivityItem
        actor="Ada Lovelace"
        action="created project"
        target="Engine"
        timeAgo="6h ago"
        metrics={[{ id: "m", value: "18", label: "Issues" }]}
        testID="activity-a"
        onPress={onPress}
      />,
    );
    expect(screen.getByText("AL")).toBeOnTheScreen();
    expect(screen.getByText("18")).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByLabelText("Ada Lovelace created project Engine, 6h ago"),
    );
    await fireEvent.press(screen.getByTestId("activity-a"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders a photo without metrics or press handling", async () => {
    await render(
      <ActivityItem
        actor="Grace"
        action="closed"
        target="Bug"
        timeAgo="1d ago"
        photo="https://example.com/g.png"
        testID="activity-b"
      />,
    );
    expect(screen.queryByText("G")).toBeNull();
    expect(screen.getByTestId("activity-b")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("<ActivityList />", () => {
  it("groups entries on one card and keeps each pressable", async () => {
    const onPress = jest.fn();
    await render(
      <ActivityList
        testID="feed"
        items={[
          { id: "a", actor: "Ada", action: "built", target: "App", timeAgo: "1m ago", testID: "activity-a", onPress },
          { id: "b", actor: "Grace", action: "ran", target: "Tests", timeAgo: "2m ago", testID: "activity-b" },
        ]}
      />,
    );
    expect(screen.getByTestId("feed")).toBeOnTheScreen();
    expect(screen.getByTestId("activity-b")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("activity-a"));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("<ChoiceGroup />", () => {
  it("selects and long-presses options in both layouts", async () => {
    const onSelect = jest.fn();
    const onLongPress = jest.fn();
    const options = [
      { id: "a", label: "Alpha", icon: FolderIcon },
      { id: "b", label: "Beta" },
    ];
    await render(
      <ChoiceGroup
        options={options}
        selectedId="a"
        onSelect={onSelect}
        onLongPress={onLongPress}
        label="Pick"
      />,
    );
    await fireEvent.press(screen.getByLabelText("Beta"));
    await fireEvent(screen.getByLabelText("Alpha"), "longPress");
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(onLongPress).toHaveBeenCalledWith("a");
    expect(
      screen.getByLabelText("Alpha").props.accessibilityState.selected,
    ).toBe(true);

    await render(
      <ChoiceGroup
        options={options}
        selectedId={null}
        onSelect={onSelect}
        scrollable
        label="Scroll"
      />,
    );
    expect(screen.getByLabelText("Scroll")).toBeOnTheScreen();
    expect(
      screen.getByLabelText("Alpha").props.accessibilityState.selected,
    ).toBe(false);
  });
});

describe("small display components", () => {
  it("labels a connection dot", async () => {
    await render(<ConnectionDot tone="success" label="Online" />);
    expect(screen.getByText("Online")).toBeOnTheScreen();
    await render(<ConnectionDot tone="danger" />);
    expect(screen.queryByText("Online")).toBeNull();
  });

  it("renders key/value rows with tones", async () => {
    await render(
      <KeyValueRow label="Branch" value="main" monospace tone="warning" />,
    );
    expect(screen.getByLabelText("Branch: main")).toBeOnTheScreen();
    await render(<KeyValueRow label="Host" value="sandbox" />);
    expect(screen.getByText("sandbox")).toBeOnTheScreen();
  });

  it("clamps progress bars and handles unknown progress", async () => {
    await render(<ProgressBar progress={1.7} label="Upload" />);
    expect(screen.getByLabelText("Upload").props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 100,
    });
    await render(<ProgressBar progress={-1} label="Upload" tone="danger" />);
    expect(screen.getByLabelText("Upload").props.accessibilityValue.now).toBe(
      0,
    );
    await render(<ProgressBar progress={null} label="Upload" />);
    expect(
      screen.getByLabelText("Upload").props.accessibilityValue,
    ).toBeUndefined();
  });

  it("draws a clamped progress ring with an optional label", async () => {
    await render(<ProgressRing progress={0.426} />);
    expect(screen.getByText("43%")).toBeOnTheScreen();
    await render(
      <ProgressRing
        progress={3}
        labelColor="#fff"
        color="#000"
        trackColor="#111"
      />,
    );
    expect(screen.getByText("100%")).toBeOnTheScreen();
    await render(<ProgressRing progress={0.5} showLabel={false} />);
    expect(screen.queryByText("50%")).toBeNull();
  });

  it("shows empty states with loading, primary and secondary actions", async () => {
    const onAction = jest.fn();
    const onSecondary = jest.fn();
    await render(
      <EmptyState
        title="Nothing"
        message="Add one"
        icon={FolderIcon}
        actionLabel="Add"
        onAction={onAction}
        secondaryLabel="Later"
        onSecondary={onSecondary}
      />,
    );
    await fireEvent.press(screen.getByLabelText("Add"));
    await fireEvent.press(screen.getByLabelText("Later"));
    expect(onAction).toHaveBeenCalled();
    expect(onSecondary).toHaveBeenCalled();

    await render(<EmptyState title="Loading…" loading actionLabel="Add" />);
    expect(screen.getByLabelText("Loading…")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Add")).toBeNull();
  });

  it("renders notices with and without actions", async () => {
    const onAction = jest.fn();
    await render(
      <Notice
        tone="danger"
        title="Oops"
        message="Broken"
        icon={FolderIcon}
        actionLabel="Retry"
        onAction={onAction}
      />,
    );
    await fireEvent.press(screen.getByLabelText("Retry"));
    expect(onAction).toHaveBeenCalled();
    await render(<Notice message="Plain" actionLabel="Retry" />);
    expect(screen.queryByLabelText("Retry")).toBeNull();
  });
});

describe("<ListCard />", () => {
  it("renders a static card with a trailing figure", async () => {
    await render(
      <ListCard
        icon={FileTextIcon}
        title="Forms"
        value="2,079"
        valueLabel="Responses"
      />,
    );
    expect(screen.getByText("Responses")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is pressable with a combined label", async () => {
    const onPress = jest.fn();
    await render(
      <ListCard
        icon={FileTextIcon}
        title="App"
        subtitle="Expo"
        value="3"
        onPress={onPress}
      />,
    );
    await fireEvent.press(screen.getByLabelText("App, Expo, 3"));
    expect(onPress).toHaveBeenCalled();
  });
});

describe("<ProfileHero />", () => {
  const metrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, bottom: 34, left: 0, right: 0 },
  };

  it("renders identity, team and stats with nav buttons", async () => {
    const onPressBack = jest.fn();
    const onPressMenu = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProfileHero
          name="Louis Saville"
          tagline="Lead"
          team="Core"
          stats={[
            { id: "a", value: "24", label: "Projects" },
            { id: "b", value: "38", label: "Cycles" },
          ]}
          nameTestID="profile-name"
          teamTestID="profile-tailnet"
          onPressBack={onPressBack}
          onPressMenu={onPressMenu}
        />
      </SafeAreaProvider>,
    );
    expect(screen.getByText("LS")).toBeOnTheScreen();
    expect(screen.getByTestId("profile-name")).toHaveTextContent(
      "Louis Saville",
    );
    expect(screen.getByTestId("profile-tailnet")).toHaveTextContent("Core");
    expect(screen.getByText("Cycles")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Go back"));
    await fireEvent.press(screen.getByLabelText("Profile options"));
    expect(onPressBack).toHaveBeenCalled();
    expect(onPressMenu).toHaveBeenCalled();
  });

  it("renders a photo and no nav buttons", async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProfileHero
          name="Ada"
          tagline="x"
          photo="https://example.com/a.png"
          stats={[]}
        />
      </SafeAreaProvider>,
    );
    expect(screen.queryByText("A")).toBeNull();
    expect(screen.queryByLabelText("Profile options")).toBeNull();
    expect(screen.queryByLabelText("Go back")).toBeNull();
  });
});

describe("<ProjectCard />", () => {
  const fields = {
    status: {
      caption: "Status",
      value: "Running",
      tone: "success" as const,
      icon: PlusIcon,
    },
    tag: { caption: "Framework", value: "Expo", icon: FolderIcon },
    detail: { caption: "Branch", value: "main" },
  };

  it("renders its fields and members, and wires its buttons", async () => {
    const onPress = jest.fn();
    const onPressMenu = jest.fn();
    const onPressChat = jest.fn();
    await render(
      <ProjectCard
        title="Revamp"
        subtitle="3f2a9c1 · Initial commit"
        {...fields}
        members={people}
        membersTitle="4 active tasks"
        membersCaption="in this project"
        testID="project-card-revamp"
        onPress={onPress}
        onPressMenu={onPressMenu}
        onPressChat={onPressChat}
      />,
    );
    expect(screen.getByText("4 active tasks")).toBeOnTheScreen();
    expect(screen.getByText("in this project")).toBeOnTheScreen();
    expect(screen.getByText("3f2a9c1 · Initial commit")).toBeOnTheScreen();
    expect(screen.getByText("Framework")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("More options for Revamp"));
    await fireEvent.press(screen.getByLabelText("Open Revamp conversation"));
    await fireEvent.press(screen.getByTestId("project-card-revamp"));
    expect(
      screen.getByLabelText("Revamp, Running, Expo, main"),
    ).toBeOnTheScreen();
    expect(onPressMenu).toHaveBeenCalled();
    expect(onPressChat).toHaveBeenCalled();
    expect(onPress).toHaveBeenCalled();
  });

  it("renders a static card without members or icons", async () => {
    await render(
      <ProjectCard
        title="Solo"
        status={{ caption: "Status", value: "Idle" }}
        tag={{ caption: "Framework", value: "Node", tone: "warning" }}
        detail={{ caption: "Branch", value: "No git" }}
        members={[]}
        membersTitle="No active tasks"
        chatLabel="Ask Claude about Solo"
        onPressChat={jest.fn()}
        testID="project-card-solo"
      />,
    );
    expect(screen.getByTestId("project-card-solo")).toBeOnTheScreen();
    expect(screen.getByText("No active tasks")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ask Claude about Solo")).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Solo,/)).toBeNull();
  });
});

describe("<StatCard /> and <StatGrid />", () => {
  it("renders cards in every tone", async () => {
    const onPress = jest.fn();
    await render(
      <StatGrid
        items={[
          {
            id: "a",
            icon: FolderIcon,
            label: "CPU",
            value: "0.42",
            unit: "/ 8 cores",
            progress: 0.05,
            onPress,
          },
          {
            id: "b",
            icon: FolderIcon,
            label: "Active",
            value: "198",
            tone: "violet",
          },
        ]}
      />,
    );
    expect(screen.getByText("5%")).toBeOnTheScreen();
    expect(screen.getByText("198")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("CPU, 0.42/ 8 cores"));
    expect(onPress).toHaveBeenCalled();

    await render(
      <StatCard
        icon={FolderIcon}
        label="Rating"
        value="4.9"
        tone="indigo"
        progress={0.9}
        onPress={onPress}
      />,
    );
    expect(screen.getByLabelText("Rating, 4.9")).toBeOnTheScreen();
    expect(screen.getByText("90%")).toBeOnTheScreen();

    await render(<StatCard icon={FolderIcon} label="Active projects" value="2" unit="/ 2" progress={1} tone="lavender" />);
    expect(screen.getByRole("progressbar").props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100 });
    expect(screen.getByText("100%")).toBeOnTheScreen();
    expect(screen.getByText("/ 2")).toBeOnTheScreen();
  });
});

describe("<ScreenHeader />", () => {
  it("shows back or close and the actions", async () => {
    const onBack = jest.fn();
    const onAction = jest.fn();
    await render(
      <ScreenHeader
        title="Project"
        subtitle="Electron"
        onBack={onBack}
        actions={[{ id: "x", icon: PlusIcon, label: "Add", onPress: onAction }]}
        large
      />,
    );
    await fireEvent.press(screen.getByLabelText("Go back"));
    await fireEvent.press(screen.getByLabelText("Add"));
    expect(onBack).toHaveBeenCalled();
    expect(onAction).toHaveBeenCalled();

    await render(<ScreenHeader title="Pair" onBack={onBack} dismissible />);
    expect(screen.getByLabelText("Close")).toBeOnTheScreen();
    await render(<ScreenHeader title="Bare" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("<TextField />", () => {
  it("tracks focus, forwards focus events and shows error over hint", async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(
      <TextField
        label="Name"
        hint="Pick one"
        error="Required"
        onFocus={onFocus}
        onBlur={onBlur}
        multiline
      />,
    );
    const input = screen.getByLabelText("Name");
    await fireEvent(input, "focus", {});
    await fireEvent(input, "blur", {});
    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
    expect(screen.getByText("Required")).toBeOnTheScreen();
    expect(screen.queryByText("Pick one")).toBeNull();

    await render(<TextField label="Host" hint="Pick one" monospace />);
    await fireEvent(screen.getByLabelText("Host"), "focus", {});
    await fireEvent(screen.getByLabelText("Host"), "blur", {});
    expect(screen.getByText("Pick one")).toBeOnTheScreen();
  });
});

describe("pre-existing chrome", () => {
  it("renders the AI button", async () => {
    const onPress = jest.fn();
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, bottom: 34, left: 0, right: 0 },
        }}
      >
        <AiFab onPress={onPress} />
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByLabelText("Ask AI"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders the home header", async () => {
    const onOpenMenu = jest.fn();
    await render(<HomeHeader onOpenMenu={onOpenMenu} />);
    await fireEvent.press(screen.getByLabelText("Open menu"));
    expect(onOpenMenu).toHaveBeenCalled();
    expect(screen.queryByLabelText(/Open inbox/)).toBeNull();

    await render(<HomeHeader />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens the inbox and badges the unread count", async () => {
    const onOpenInbox = jest.fn();
    await render(
      <HomeHeader onOpenInbox={onOpenInbox} inboxCount={3} />,
    );
    expect(screen.getByText("3", { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Open inbox, 3 unread"));
    expect(onOpenInbox).toHaveBeenCalled();

    await render(<HomeHeader onOpenInbox={onOpenInbox} inboxCount={0} />);
    expect(screen.getByLabelText("Open inbox")).toBeOnTheScreen();
    expect(screen.queryByText("0", { includeHiddenElements: true })).toBeNull();
  });
});
