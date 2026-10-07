import type { SVGProps } from "react";

const paths = {
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8",
  monitor: "M3 5h18v11H3zM8 20h8M12 16v4",
  terminal: "M4 5h16v14H4zM8 10l3 2-3 2M13 15h3",
  package: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9M8 5.3l8 4.5",
  bell: "M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0",
  microphone: "M9 5a3 3 0 016 0v6a3 3 0 01-6 0zM5 11a7 7 0 0014 0M12 18v3",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  files: "M8 3h7l5 5v10H8zM15 3v5h5M4 7v14h12",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  desktop: "M3 4h18v12H3zM9 20h6M12 16v4M3 13h18",
  apple:
    "M16.5 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.9-.8-3.1-.8c-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 2.9 2.4s1.6-.8 3-.8 1.8.8 3 .8 2-1.2 2.8-2.4c.9-1.3 1.2-2.6 1.3-2.7-.1 0-2.4-.9-2.3-4.1zM14.3 5.6c.6-.8 1.1-1.8 1-2.9-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.7-1 2.8 1 .1 2.1-.5 2.7-1.3z",
  play: "M5 3.5v17a.5.5 0 00.8.4l14-8.5a.5.5 0 000-.8l-14-8.5a.5.5 0 00-.8.4zM5.3 3.4L15 13M5.3 20.6L15 11",
  android: "M6 10h12v8a1 1 0 01-1 1H7a1 1 0 01-1-1zM6 9a6 6 0 0112 0zM8 4l1.5 2M16 4l-1.5 2M9.5 7.5h0M14.5 7.5h0M3.5 11v5M20.5 11v5",
  linux: "M12 3c-2 0-3 1.8-3 4v3c-1.5 2-3 4-3 7 0 2 1 3 2 3h8c1 0 2-1 2-3 0-3-1.5-5-3-7V7c0-2.2-1-4-3-4zM10.5 7h0M13.5 7h0M11 9h2",
  docker: "M3 12h17c.5-1 1.5-1.5 2-1.5-.5-1-1.5-1.3-2.3-1.1C19.4 8 18.7 7.5 18 7.3c-.4 1-.3 2.2.2 3M3 12c0 4 3 7 8 7 5.5 0 8.5-3 9.3-7M5 9h3v3H5zM8 9h3v3H8zM11 9h3v3h-3zM8 6h3v3H8zM11 6h3v3h-3z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  house: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
  robot: "M5 9h14v10H5zM12 5v4M9 13h0M15 13h0M9 16h6M2 13v2M22 13v2M12 5a1 1 0 100-2 1 1 0 000 2z",
  listChecks: "M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9",
  folders: "M3 7h6l2 2h8v9H3zM7 4h5l2 2h7v9",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4.5-6 8-6s7 2 8 6",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  pencil: "M4 20l1-5L16 4l4 4L9 19zM14 6l4 4",
  menu: "M4 7h16M4 12h16M4 17h10",
  plus: "M12 5v14M5 12h14",
  send: "M12 19V5M6 11l6-6 6 6",
  check: "M5 12l5 5 9-10",
  branch: "M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9c0 6-12 3-12 9",
  dot: "M12 13a1 1 0 100-2 1 1 0 000 2z",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 018 0v3",
  chevron: "M9 6l6 6-6 6",
} as const;

export type IconName = keyof typeof paths;

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export default function Icon({ name, size = 20, strokeWidth = 1.6, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
