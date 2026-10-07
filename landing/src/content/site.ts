import type { IconName } from "@/components/icon";

export const site = {
  name: "Monolith",
  title: "Monolith: the development machine in your pocket",
  description:
    "Monolith runs Claude Code in a private sandbox and puts the whole machine in your pocket: agents, builds, terminals and a live display, over your own Tailscale network.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100",
};

export type Shot = { src: string; alt: string; tone: "dark" | "light" };

export const shots = {
  inboxDark: { src: "/screens/inbox-dark.png", alt: "Monolith inbox with finished Claude runs", tone: "dark" },
  inboxLight: { src: "/screens/inbox-light.png", alt: "Monolith inbox in light mode", tone: "light" },
  runDark: { src: "/screens/run-dark.png", alt: "A finished Claude run with its summary", tone: "dark" },
  runLight: { src: "/screens/run-light.png", alt: "Claude run showing Bash and Write steps", tone: "light" },
  projects: { src: "/screens/projects-dark.png", alt: "Projects with status, framework and branch", tone: "dark" },
} satisfies Record<string, Shot>;

export const nav = [
  { label: "Agents", href: "#agents" },
  { label: "Inbox", href: "#inbox" },
  { label: "Projects", href: "#projects" },
  { label: "Security", href: "#security" },
  { label: "Download", href: "#download" },
];

export const hero = {
  announcement: { tag: "New", label: "Build progress in Live Activities", href: "#inbox" },
  title: ["The development machine", "in your pocket"],
  lead: "Monolith runs Claude Code in a private sandbox and puts the whole machine in your pocket: agents, builds, terminals and a live display.",
  primary: { label: "Download for iPhone", href: "#download" },
  secondary: { label: "Get the Android app", href: "#download" },
};

export const toolchain = ["Claude Code", "Expo", "React Native", "Electron", "Android SDK", "Bun", "Node.js", "Python", "Docker", "Tailscale"];

export const statement =
  "Monolith is a new kind of development machine. It lives in a container on your own server, runs Claude Code around the clock and answers to your phone. Ask for a change, approve it from your Lock Screen and download the build, wherever you are.";

export type Point = { icon: IconName; title: string; body: string };

export type Section = {
  id: string;
  index: string;
  label: string;
  title: string;
  body: string;
  points: Point[];
};

export const sections: Section[] = [
  {
    id: "agents",
    index: "1.0",
    label: "Agents",
    title: "Claude Code that keeps working when you put your phone down",
    body: "Start a run from anywhere and follow every tool call, diff and test result as it streams in. Claude works inside your sandbox, with your repos, your toolchains and your tests.",
    points: [
      { icon: "terminal", title: "Live tool steps", body: "Bash, edits and writes stream in as Claude makes them." },
      { icon: "sparkle", title: "Plan or full access", body: "Pick a mode per run and switch models on the fly." },
      { icon: "microphone", title: "Talk instead of type", body: "Voice prompts are transcribed inside your sandbox." },
    ],
  },
  {
    id: "inbox",
    index: "2.0",
    label: "Inbox",
    title: "Only the things that need you",
    body: "Permission prompts, questions and finished runs land in a single inbox. Approve with a tap, and Claude picks up where it stopped.",
    points: [
      { icon: "shield", title: "Remote approvals", body: "Allow or deny a tool call without opening a laptop." },
      { icon: "bell", title: "One push per run", body: "Each finished run sends exactly one notification." },
      { icon: "monitor", title: "Live Activities", body: "Build progress on the Lock Screen and in the Dynamic Island." },
    ],
  },
  {
    id: "projects",
    index: "3.0",
    label: "Projects",
    title: "Every project, build and port in one place",
    body: "Clone a repo, queue a build and keep dev servers running even when your phone disconnects. Finished artifacts come with a checksum and are ready to download.",
    points: [
      { icon: "package", title: "Real builds", body: "Android APK and AAB, Linux AppImage, Windows installers and web." },
      { icon: "files", title: "Verified artifacts", body: "Every artifact gets a SHA-256 and a predictable name." },
      { icon: "globe", title: "Ports on your tailnet", body: "Open a running dev server straight from the app." },
    ],
  },
  {
    id: "security",
    index: "4.0",
    label: "Security",
    title: "Your machine, on your network",
    body: "The sandbox is reachable only over your Tailscale network, and every request is authenticated. The host just runs Docker. Nothing is exposed to the internet.",
    points: [
      { icon: "lock", title: "Tailnet only", body: "WireGuard end to end. No public ports, no tunnels." },
      { icon: "shield", title: "Token auth", body: "Every request and socket is authenticated." },
      { icon: "desktop", title: "Clean host", body: "Toolchains, caches and secrets stay in the container." },
    ],
  },
];

export const agentSteps = [
  { label: "Read", detail: "src/auth/session.ts", state: "done" },
  { label: "Edit", detail: "session.ts  +12 −4", state: "done" },
  { label: "Bash", detail: "bun run test", result: "84 passed", state: "done" },
  { label: "Build", detail: "android-apk · release", result: "64%", state: "running" },
];

export const notifications = [
  { title: "Claude finished", body: "expensifo · All 84 tests pass. Release APK is building.", time: "now" },
  { title: "Needs your approval", body: "Run ./gradlew assembleRelease?", time: "2m ago" },
  { title: "Build ready", body: "expensifo-android-release-1.4.0.apk · 48.2 MB", time: "6m ago" },
];

export const buildStages = [
  { label: "Install", time: "18s", state: "done" },
  { label: "Prebuild", time: "41s", state: "done" },
  { label: "Gradle assembleRelease", time: "2m 06s", state: "running" },
  { label: "Verify & copy artifact", time: "", state: "queued" },
];

export const build = {
  id: "bld_7f3k2q9xa1",
  project: "expensifo",
  target: "android-apk · release",
  progress: 64,
  artifact: "expensifo-android-release-1.4.0.apk",
  sha: "sha256 9f2c…b41e",
};

export const topology = [
  { id: "phone", label: "Phone", detail: "Monolith app" },
  { id: "tailnet", label: "Tailnet", detail: "WireGuard" },
  { id: "sandbox", label: "Sandbox", detail: "Claude · builds · display" },
];

export const more: Point[] = [
  { icon: "monitor", title: "Live display", body: "Watch and drive the sandbox desktop over VNC." },
  { icon: "terminal", title: "Real terminals", body: "Full PTYs that keep running after you disconnect." },
  { icon: "files", title: "Files & Taildrop", body: "Browse outputs and send them to any device." },
  { icon: "chart", title: "Usage", body: "Token trends by day, project and session." },
  { icon: "user", title: "Multiple accounts", body: "Pick the Claude account for each project." },
  { icon: "desktop", title: "Desktop companion", body: "A native Linux app for the same sandbox." },
];

export type Download = { id: string; icon: IconName; label: string; detail: string; href?: string };

export const downloads: Download[] = [
  { id: "ios", icon: "apple", label: "App Store", detail: "iPhone · iOS 18+", href: process.env.NEXT_PUBLIC_APP_STORE_URL },
  { id: "play", icon: "play", label: "Google Play", detail: "Android 10+", href: process.env.NEXT_PUBLIC_PLAY_STORE_URL },
  { id: "apk", icon: "android", label: "Android APK", detail: "Direct install", href: process.env.NEXT_PUBLIC_APK_URL },
  { id: "desktop", icon: "linux", label: "Desktop", detail: "Linux · GTK 4", href: process.env.NEXT_PUBLIC_DESKTOP_URL },
  { id: "sandbox", icon: "docker", label: "Sandbox", detail: "Any Docker host", href: process.env.NEXT_PUBLIC_SANDBOX_URL },
];

export const cta = {
  title: ["Built for shipping.", "Available today."],
  soon: "Coming soon",
};

export const footer = {
  columns: [
    { title: "Product", links: [{ label: "Agents", href: "#agents" }, { label: "Inbox", href: "#inbox" }, { label: "Projects", href: "#projects" }, { label: "Security", href: "#security" }] },
    { title: "Platforms", links: [{ label: "iPhone", href: "#download" }, { label: "Android", href: "#download" }, { label: "Linux desktop", href: "#download" }, { label: "Sandbox image", href: "#download" }] },
  ],
  note: "Claude is a trademark of Anthropic.",
};
