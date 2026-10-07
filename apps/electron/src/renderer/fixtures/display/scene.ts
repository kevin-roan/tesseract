export const SCENE_WIDTH = 1600;
export const SCENE_HEIGHT = 900;
export const SCENE_NAME = "TheOne theone-sandbox";

const COLORS = {
  page: "#ffffff",
  tabStrip: "#d3e3fd",
  tabButton: "#ecf3fe",
  text: "#1f1f1f",
  muted: "#5f6368",
  disabled: "#b4b7bb",
  profile: "#5b8def",
  omniboxBorder: "#276ad5",
  selection: "#3574d8",
  divider: "#f2f3f2",
  shadow: ["#e9ebea", "#dddfdf", "#f4f5f5"],
  cursor: "#000000",
} as const;

const FONT = "Inter, sans-serif";

const NO_SANDBOX_WARNING = "You are using an unsupported command-line flag: --no-sandbox. Stability and security will suffer.";
const TAB_TITLE = "about:blank";
const INFOBAR_FONT_SIZE = 15;
const INFOBAR_CENTER_X = 790;

const CURSOR: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, 17],
  [4, 13],
  [7, 20],
  [10, 19],
  [7, 12],
  [12, 12],
];
const CURSOR_AT = { x: 798, y: 460 } as const;

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function stroke(context: CanvasRenderingContext2D, color: string, width: number, draw: () => void) {
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  draw();
  context.stroke();
}

function cross(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.moveTo(x - size, y - size);
  context.lineTo(x + size, y + size);
  context.moveTo(x + size, y - size);
  context.lineTo(x - size, y + size);
}

function chevron(context: CanvasRenderingContext2D, x: number, y: number, size: number, direction: 1 | -1) {
  context.moveTo(x - size * direction, y);
  context.lineTo(x + size * direction, y);
  context.moveTo(x, y - size);
  context.lineTo(x + size * direction, y);
  context.lineTo(x, y + size);
}

function paintTabStrip(context: CanvasRenderingContext2D, width: number) {
  context.fillStyle = COLORS.tabStrip;
  context.fillRect(0, 0, width, 40);
  context.fillStyle = COLORS.tabButton;
  roundedRect(context, 8, 7, 26, 26, 6);
  context.fill();
  stroke(context, COLORS.text, 2, () => {
    context.moveTo(17, 18);
    context.lineTo(21, 22);
    context.lineTo(25, 18);
  });
  context.fillStyle = COLORS.page;
  roundedRect(context, 41, 6, 226, 40, 10);
  context.fill();
  stroke(context, COLORS.muted, 2, () => context.arc(55, 23, 7, 0, Math.PI * 2));
  context.fillStyle = COLORS.text;
  context.font = `14px ${FONT}`;
  context.textBaseline = "middle";
  context.fillText(TAB_TITLE, 70, 24);
  stroke(context, COLORS.muted, 1.5, () => cross(context, 255, 23, 4));
  stroke(context, COLORS.text, 2, () => {
    context.moveTo(284, 23);
    context.lineTo(298, 23);
    context.moveTo(291, 16);
    context.lineTo(291, 30);
  });
  stroke(context, COLORS.muted, 1.5, () => {
    context.moveTo(1509, 25);
    context.lineTo(1521, 25);
    context.rect(1541, 16, 10, 10);
  });
  stroke(context, COLORS.muted, 1.5, () => cross(context, 1579, 21, 4));
}

function paintToolbar(context: CanvasRenderingContext2D, width: number) {
  context.fillStyle = COLORS.page;
  context.fillRect(0, 40, width, 46);
  stroke(context, COLORS.disabled, 1.5, () => chevron(context, 22, 63, 5, -1));
  stroke(context, COLORS.disabled, 1.5, () => chevron(context, 59, 63, 5, 1));
  stroke(context, COLORS.muted, 1.5, () => context.arc(95, 63, 6, 0.3, Math.PI * 1.8));
  stroke(context, COLORS.omniboxBorder, 3, () => context.roundRect(122, 46, 1390, 34, 17));
  stroke(context, COLORS.muted, 1.5, () => context.arc(137, 63, 6, 0, Math.PI * 2));
  context.fillStyle = COLORS.selection;
  context.fillRect(158, 54, 86, 18);
  context.fillStyle = COLORS.page;
  context.fillText(TAB_TITLE, 160, 63);
  stroke(context, COLORS.muted, 1.5, () => context.arc(1490, 63, 6, 0, Math.PI * 2));
  stroke(context, COLORS.profile, 2, () => context.arc(1537, 63, 7, 0, Math.PI * 2));
  context.fillStyle = COLORS.muted;
  [56, 63, 70].forEach((y) => context.fillRect(1572, y - 1, 3, 3));
}

export function paintScene(context: CanvasRenderingContext2D): void {
  const width = SCENE_WIDTH;
  context.fillStyle = COLORS.page;
  context.fillRect(0, 0, width, SCENE_HEIGHT);
  paintTabStrip(context, width);
  paintToolbar(context, width);

  context.fillStyle = COLORS.divider;
  context.fillRect(0, 85, width, 2);
  context.fillStyle = COLORS.text;
  context.font = `${INFOBAR_FONT_SIZE}px ${FONT}`;
  context.textAlign = "center";
  context.fillText(NO_SANDBOX_WARNING, INFOBAR_CENTER_X, 115);
  context.textAlign = "left";
  stroke(context, COLORS.muted, 1.5, () => cross(context, 1568, 115, 4));
  COLORS.shadow.forEach((color, index) => {
    context.fillStyle = color;
    context.fillRect(0, 141 + index * 2, width, 2);
  });

  context.fillStyle = COLORS.cursor;
  context.beginPath();
  CURSOR.forEach(([x, y], index) => (index === 0 ? context.moveTo(CURSOR_AT.x + x, CURSOR_AT.y + y) : context.lineTo(CURSOR_AT.x + x, CURSOR_AT.y + y)));
  context.closePath();
  context.fill();
}

export function renderScenePixels(): Uint8ClampedArray {
  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  if (canvas) {
    canvas.width = SCENE_WIDTH;
    canvas.height = SCENE_HEIGHT;
    const context = canvas.getContext("2d");
    if (context && typeof context.roundRect === "function") {
      paintScene(context);
      return context.getImageData(0, 0, SCENE_WIDTH, SCENE_HEIGHT).data;
    }
  }
  return new Uint8ClampedArray(SCENE_WIDTH * SCENE_HEIGHT * 4).fill(255);
}

export function sceneSvg(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SCENE_WIDTH}" height="${SCENE_HEIGHT}" viewBox="0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}">`,
    `<rect width="${SCENE_WIDTH}" height="${SCENE_HEIGHT}" fill="${COLORS.page}"/>`,
    `<rect width="${SCENE_WIDTH}" height="40" fill="${COLORS.tabStrip}"/>`,
    `<rect x="40" y="6" width="240" height="40" rx="10" fill="${COLORS.page}"/>`,
    `<text x="82" y="29" font-family="${FONT}" font-size="14" fill="${COLORS.text}">${TAB_TITLE}</text>`,
    `<rect x="122" y="46" width="1390" height="34" rx="17" fill="none" stroke="${COLORS.omniboxBorder}" stroke-width="3"/>`,
    `<rect y="85" width="${SCENE_WIDTH}" height="2" fill="${COLORS.divider}"/>`,
    `<text x="${SCENE_WIDTH / 2}" y="119" text-anchor="middle" font-family="${FONT}" font-size="14" fill="${COLORS.text}">${NO_SANDBOX_WARNING}</text>`,
    `<rect y="141" width="${SCENE_WIDTH}" height="6" fill="${COLORS.shadow[1]}"/>`,
    "</svg>",
  ].join("");
}
