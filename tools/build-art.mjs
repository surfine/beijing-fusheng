// The redrawn art of 北京浮生记: seven icons and four pictures, written as
// vector masters and exported to PNG. One light (upper left), one outline,
// one hard shadow, flat colour, nothing else. See docs/03-美术bible.md.
//
// Needs rsvg-convert for the PNG exports; the SVG masters need nothing.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = join(root, "art", "icons");
const pictureDir = join(root, "art", "bitmaps");
mkdirSync(iconDir, { recursive: true });
mkdirSync(pictureDir, { recursive: true });

export const palette = {
  blue: "#0000FF",
  white: "#FFFFFF",
  yellow: "#FFFF00",
  cyan: "#00FFFF",
  black: "#000000",
  gray: "#C0C0C0",
  darkGray: "#808080",
  red: "#FF0000",
  green: "#008000",
  brightGreen: "#00FF00",
  olive: "#808000",
};
const P = palette;

// ---- the rules every icon obeys ---------------------------------------------
// Master: 1024 x 1024, one unit of the original's 32 px grid is 32 here.
const LINE = 40; // the outline, 1.25 px at 32
const LINE_16 = 64; // the outline of the 16 px cut, 1 px at 16
const SHADOW = 40; // the hard shadow lies this far down and to the right
const stroke = (width = LINE) =>
  `stroke="${P.black}" stroke-width="${width}" stroke-linejoin="miter" stroke-linecap="square"`;

/** The silhouette once more, in cyan, moved down and right: the only shadow there is. */
const shadow = (shapes) =>
  `<g transform="translate(${SHADOW} ${SHADOW})" fill="${P.cyan}" stroke="${P.cyan}" stroke-width="${LINE}" stroke-linejoin="miter">${shapes}</g>`;

const icon = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">\n${body}\n</svg>\n`;

const icons = {};

// -- city: the program's own icon (original 14). Gray sky, three black blocks
// with white windows on a grid, a red disc of a sun with three yellow rays,
// yellow ground, the olive bank in front.
{
  const windows = (x0, y0, columns, rows) => {
    let out = "";
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        out += `<rect x="${x0 + column * 80}" y="${y0 + row * 96}" width="40" height="48"/>`;
      }
    }
    return out;
  };
  const scene = (detail) => `
  <rect x="32" y="32" width="896" height="896" fill="${P.gray}"/>
  <g stroke="${P.yellow}" stroke-width="${detail ? 36 : 64}" stroke-linecap="butt">
    <path d="M700 150H540"/>${detail ? `<path d="M730 230L610 350"/><path d="M800 270V410"/>` : ""}
  </g>
  <circle cx="800" cy="150" r="${detail ? 84 : 110}" fill="${P.red}"/>
  <g fill="${P.black}">
    <rect x="80" y="210" width="190" height="420"/>
    <rect x="300" y="80" width="190" height="550"/>
    ${detail ? `<rect x="540" y="430" width="190" height="200"/><rect x="730" y="520" width="110" height="110"/>` : `<rect x="540" y="400" width="250" height="230"/>`}
  </g>
  ${detail ? `<g fill="${P.white}">${windows(115, 250, 2, 4)}${windows(335, 120, 2, 5)}${windows(575, 470, 2, 1)}</g>` : ""}
  <rect x="32" y="630" width="896" height="298" fill="${P.yellow}"/>
  <path d="M32 800H330L450 720H928V928H32Z" fill="${P.olive}"/>
  <path d="M32 800H330L450 720H928" fill="none" ${stroke(detail ? LINE : LINE_16)}/>
  <path d="M32 630H928" fill="none" ${stroke(detail ? LINE : LINE_16)}/>
  <rect x="32" y="32" width="896" height="896" fill="none" ${stroke(detail ? LINE : LINE_16)}/>`;
  const tile = `<rect x="32" y="32" width="896" height="896"/>`;
  icons.city = icon(shadow(tile) + scene(true));
  icons["city-16"] = icon(`
  <rect x="64" y="64" width="960" height="960" fill="${P.cyan}"/>
  <rect x="0" y="0" width="960" height="960" fill="${P.gray}"/>
  <rect x="640" y="64" width="256" height="256" fill="${P.red}"/>
  <g fill="${P.black}"><rect x="64" y="256" width="192" height="384"/><rect x="320" y="64" width="192" height="576"/><rect x="576" y="448" width="256" height="192"/></g>
  <rect x="0" y="640" width="960" height="320" fill="${P.yellow}"/>
  <rect x="0" y="832" width="960" height="128" fill="${P.olive}"/>
  <rect x="32" y="32" width="896" height="896" fill="none" ${stroke(LINE_16)}/>`);
}

// -- goods: one line of goods in the lists (original 2). A round cyan bag
// with a yellow $, a green top and a red tie.
{
  const outline = `<path d="M370 100L470 170L590 70L650 140L580 230H420Z"/><rect x="420" y="230" width="150" height="60"/><circle cx="496" cy="630" r="350"/>`;
  const bag = (detail) => `
  <circle cx="496" cy="630" r="350" fill="${P.cyan}" ${stroke(detail ? LINE : LINE_16)}/>
  <path d="M370 100L470 170L590 70L650 140L580 230H420Z" fill="${P.green}" ${stroke(detail ? LINE : LINE_16)}/>
  <rect x="420" y="230" width="150" height="60" fill="${P.red}" ${stroke(detail ? LINE : LINE_16)}/>
  <g fill="none" stroke="${P.yellow}" stroke-width="${detail ? 44 : 80}" stroke-linejoin="miter">
    ${
      detail
        ? `<path d="M650 510H420Q340 510 340 575Q340 640 420 640H570Q650 640 650 705Q650 770 570 770H340"/><path d="M455 430V850"/><path d="M535 430V850"/>`
        : `<path d="M640 512H384V640H640V768H384"/><path d="M512 420V860"/>`
    }
  </g>`;
  icons.goods = icon(shadow(outline) + bag(true));
  icons["goods-16"] = icon(shadow(outline) + bag(false));
}

// -- house: the rented room and the agency (original 5). Yellow roof, light
// front wall with two windows and a black door, dark side wall.
{
  const outline = `<path d="M110 450L300 250H800L920 420V740L700 900H110Z"/>`;
  const house = (detail) => `
  <path d="M700 450L800 250L920 420V740L700 900Z" fill="${P.darkGray}" ${stroke(detail ? LINE : LINE_16)}/>
  <rect x="110" y="450" width="590" height="450" fill="${P.gray}" ${stroke(detail ? LINE : LINE_16)}/>
  <path d="M110 450L300 250H800L700 450Z" fill="${P.yellow}" ${stroke(detail ? LINE : LINE_16)}/>
  <rect x="340" y="${detail ? 700 : 620}" width="130" height="${detail ? 200 : 280}" fill="${P.black}"/>
  ${detail ? `<rect x="230" y="560" width="70" height="70" fill="${P.black}"/><rect x="510" y="560" width="70" height="70" fill="${P.black}"/>` : ""}`;
  icons.house = icon(shadow(outline) + house(true));
  icons["house-16"] = icon(shadow(outline) + house(false));
}

// -- bulb: a hint (original 6). Yellow glass, a white core, a black filament,
// a black cap with two white turns.
{
  const glass = "M420 770L372 650A290 290 0 1 1 652 650L604 770Z";
  const outline = `<path d="${glass}"/><rect x="420" y="770" width="184" height="150"/><rect x="466" y="920" width="92" height="50"/>`;
  const bulb = (detail) => `
  <path d="${glass}" fill="${P.yellow}" ${stroke(detail ? LINE : LINE_16)}/>
  ${detail ? `<circle cx="470" cy="350" r="110" fill="${P.white}"/><path d="M512 460V690" fill="none" ${stroke(32)}/>` : ""}
  <rect x="420" y="770" width="184" height="150" fill="${P.black}" ${stroke(detail ? LINE : LINE_16)}/>
  ${detail ? `<rect x="420" y="806" width="184" height="26" fill="${P.white}"/><rect x="420" y="862" width="184" height="26" fill="${P.white}"/>` : ""}
  <rect x="466" y="920" width="92" height="50" fill="${P.black}"/>`;
  icons.bulb = icon(shadow(outline) + bulb(true));
  icons["bulb-16"] = icon(shadow(outline) + bulb(false));
}

// -- letter: the post office and the top ten (original 10). A gray envelope,
// a stamp box in the upper right, two lines of address.
{
  const outline = `<rect x="70" y="290" width="860" height="500"/>`;
  const letter = (detail) => `
  <rect x="70" y="290" width="860" height="500" fill="${P.gray}" ${stroke(detail ? LINE : LINE_16)}/>
  <rect x="720" y="${detail ? 350 : 370}" width="${detail ? 140 : 150}" height="${detail ? 140 : 150}" fill="${detail ? "none" : P.black}" ${detail ? stroke(36) : ""}/>
  ${detail ? `<path d="M300 590H640" fill="none" ${stroke(36)}/><path d="M380 690H600" fill="none" ${stroke(36)}/>` : `<path d="M200 660H560" fill="none" ${stroke(LINE_16)}/>`}`;
  icons.letter = icon(shadow(outline) + letter(true));
  icons["letter-16"] = icon(shadow(outline) + letter(false));
}

// -- card: papers and the bank (original 11). A yellow card, two blue lines
// of writing, a red square in a green one where the seal goes.
{
  const outline = `<rect x="70" y="290" width="860" height="500"/>`;
  const card = (detail) => `
  <rect x="70" y="290" width="860" height="500" fill="${P.yellow}" ${stroke(detail ? LINE : LINE_16)}/>
  <rect x="720" y="340" width="150" height="150" fill="${P.brightGreen}"/>
  <rect x="${detail ? 762 : 745}" y="${detail ? 382 : 365}" width="${detail ? 66 : 100}" height="${detail ? 66 : 100}" fill="${P.red}"/>
  <g fill="none" stroke="${P.blue}" stroke-width="${detail ? 44 : 72}">
    <path d="M250 610H640"/>${detail ? `<path d="M330 700H580"/>` : ""}
  </g>`;
  icons.card = icon(shadow(outline) + card(true));
  icons["card-16"] = icon(shadow(outline) + card(false));
}

// -- hospital: originals 1, 4 and 7 as one sign. A red cross, four equal arms.
{
  const cross = "M410 110H602V410H902V602H602V902H410V602H110V410H410Z";
  icons.hospital = icon(`${shadow(`<path d="${cross}"/>`)}<path d="${cross}" fill="${P.red}"/>`);
  icons["hospital-16"] = icons.hospital;
}

// ---- the four pictures -----------------------------------------------------------
// Master: 2048 on the long side. The same line and the same shadow, scaled.

const SERIF = `'Songti SC','STSong','SimSun','Noto Serif CJK SC',serif`;

/** A column of body text: short black bars, the way small type looks from afar. */
function typeColumn(x, y, width, lines, gap = 26) {
  let out = "";
  for (let line = 0; line < lines; line += 1) {
    // The last line of a paragraph is short; every fifth line ends one.
    const short = line % 5 === 4 ? 0.55 : 1;
    out += `<rect x="${x}" y="${y + line * gap}" width="${Math.round(width * short)}" height="10"/>`;
  }
  return out;
}

/** A photograph as the press prints it: black dots on white. */
function halftone(id, x, y, width, height) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#${id})" stroke="${P.black}" stroke-width="8"/>`;
}

function newspaper(title) {
  const W = 1626;
  const H = 2048;
  const px = 70; // the sheet
  const py = 330;
  const pw = 1130;
  const ph = 1580;
  const col = (pw - 100) / 3; // three columns
  const cx = (n) => px + 40 + n * (col + 10);
  const letters = [...title]
    .map(
      (letter, index) =>
        `<text x="1430" y="${420 + index * 390}" font-family="${SERIF}" font-size="330" font-weight="700" text-anchor="middle" fill="${P.yellow}">${letter}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="${P.white}"/><circle cx="8" cy="8" r="5" fill="${P.black}"/></pattern>
    <pattern id="dots-light" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="${P.white}"/><circle cx="8" cy="8" r="3" fill="${P.black}"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="${P.blue}"/>
  <rect x="${px + 44}" y="${py + 44}" width="${pw}" height="${ph}" fill="${P.cyan}"/>
  <rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${P.white}" stroke="${P.black}" stroke-width="14"/>
  <!-- the masthead: a black block, the paper's name knocked out of it -->
  <rect x="${px + 40}" y="${py + 40}" width="${pw - 80}" height="150" fill="${P.black}"/>
  <text x="${px + pw / 2}" y="${py + 152}" font-family="${SERIF}" font-size="120" font-weight="700" text-anchor="middle" fill="${P.white}" letter-spacing="30">北京真理报</text>
  <g fill="${P.black}">
    <rect x="${px + 40}" y="${py + 214}" width="${pw - 80}" height="8"/>
    <rect x="${px + 40}" y="${py + 268}" width="${pw - 80}" height="4"/>
    <rect x="${px + 60}" y="${py + 236}" width="300" height="14"/>
    <rect x="${px + pw - 300}" y="${py + 236}" width="240" height="14"/>
    <!-- the lead: a headline across two columns, a picture, three columns of type -->
    <rect x="${cx(0)}" y="${py + 310}" width="${col * 2 - 20}" height="46"/>
    <rect x="${cx(0)}" y="${py + 376}" width="${col * 1.4}" height="46"/>
    ${typeColumn(cx(0), py + 770, col - 20, 12)}
    ${typeColumn(cx(1), py + 770, col - 20, 12)}
    ${typeColumn(cx(2), py + 310, col - 20, 29)}
    <!-- column rules -->
    <rect x="${cx(1) - 12}" y="${py + 770}" width="4" height="${12 * 26}"/>
    <rect x="${cx(2) - 12}" y="${py + 300}" width="4" height="${ph - 340}"/>
    <rect x="${cx(0)}" y="${py + 1110}" width="${col * 2 - 20}" height="6"/>
    <!-- the second story: a boxed piece, a small picture -->
    <rect x="${cx(0)}" y="${py + 1150}" width="${col - 20}" height="34"/>
    ${typeColumn(cx(0), py + 1210, col - 20, 13)}
    ${typeColumn(cx(1), py + 1420, col - 20, 5)}
    ${typeColumn(cx(2), py + 1100, col - 20, 17)}
  </g>
  ${halftone("dots", cx(0), py + 450, col * 2 - 20, 290)}
  ${halftone("dots-light", cx(1), py + 1150, col - 20, 240)}
  <rect x="${cx(2)}" y="${py + 1070}" width="${col - 20}" height="6" fill="${P.black}"/>
  <!-- the band on the right, the title set down it -->
  <rect x="1290" y="0" width="280" height="${H}" fill="${P.blue}" stroke="${P.black}" stroke-width="14"/>
  <rect x="1570" y="0" width="56" height="${H}" fill="${P.black}"/>
  ${letters}
</svg>
`;
}

function dots() {
  const W = 2048;
  const H = 342;
  let out = "";
  for (let index = 0; index < 10; index += 1) out += `<circle cx="${132 + index * 198}" cy="${H / 2}" r="62"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${P.blue}"/>
  <g fill="${P.white}">${out}</g>
</svg>
`;
}

function bulbFloor() {
  const W = 2048;
  const H = 1974;
  // The floor is a square seen from above its near corner: an outline with
  // the point at the bottom, and six cyan lines that all run to that point.
  const apex = [1024, 1500];
  let floor = "";
  for (let index = 0; index < 6; index += 1) {
    const x = 620 + index * 162;
    floor += `<path d="M${x} 1010L${apex[0]} ${apex[1]}"/>`;
  }
  const rays = [
    [1024, 150, 1024, 300],
    [690, 300, 780, 390],
    [1358, 300, 1268, 390],
    [520, 640, 680, 640],
    [1528, 640, 1368, 640],
  ]
    .map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}L${x2} ${y2}"/>`)
    .join("");
  const glass = "M900 990L840 880A330 330 0 1 1 1208 880L1148 990Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <g fill="none" stroke="${P.cyan}" stroke-width="30">${floor}<path d="M700 1100H1348"/><path d="M800 1230H1248"/><path d="M900 1360H1148"/></g>
  <path d="M560 1010H1488L${apex[0]} ${apex[1]}Z" fill="none" stroke="${P.black}" stroke-width="44" stroke-linejoin="miter"/>
  <g fill="none" stroke="${P.yellow}" stroke-width="56">${rays}</g>
  <g transform="translate(44 44)"><path d="${glass}" fill="${P.cyan}"/><rect x="900" y="990" width="248" height="170" fill="${P.cyan}"/></g>
  <path d="${glass}" fill="${P.yellow}" stroke="${P.black}" stroke-width="44" stroke-linejoin="miter"/>
  <rect x="992" y="470" width="64" height="290" fill="${P.black}"/>
  <rect x="992" y="810" width="64" height="64" fill="${P.black}"/>
  <rect x="900" y="990" width="248" height="170" fill="${P.gray}" stroke="${P.black}" stroke-width="44"/>
  <rect x="900" y="1052" width="248" height="30" fill="${P.black}"/>
</svg>
`;
}

const pictures = {
  news: newspaper("今日新闻"),
  diary: newspaper("我的日记"),
  dots: dots(),
  "bulb-floor": bulbFloor(),
};

// ---- write the masters, then the PNG exports ---------------------------------------

for (const [name, svg] of Object.entries(icons)) writeFileSync(join(iconDir, `${name}.svg`), svg);
for (const [name, svg] of Object.entries(pictures)) writeFileSync(join(pictureDir, `${name}.svg`), svg);

writeFileSync(
  join(root, "art", "palette.json"),
  `${JSON.stringify(
    {
      roles: {
        ground: { light: P.blue, dark: "#0000C8", note: "蓝底：内容区底色、页眉、选中行" },
        paper: { light: P.white, dark: "#0A0A14", note: "纸：表格与账页" },
        ink: { light: P.black, dark: P.white, note: "黑线：字、栏线、描边" },
        type: { light: P.yellow, dark: P.yellow, note: "黄字：蓝底上的标题、涨、欠债增量" },
        aid: { light: P.cyan, dark: P.cyan, note: "青辅：持有标记、图标的硬边影" },
        muted: { light: P.darkGray, dark: P.darkGray, note: "灰：缺货、买不起、不可用" },
      },
      art: P,
    },
    null,
    2,
  )}\n`,
);

if (!process.argv.includes("--svg-only")) {
  const png = (source, target, width) =>
    execFileSync("rsvg-convert", ["-w", String(width), "-o", target, source], { stdio: "inherit" });
  for (const name of ["city", "goods", "house", "bulb", "letter", "card", "hospital"]) {
    for (const size of [16, 32, 128, 512, 1024]) {
      // 16 px is drawn from the simplified cut; everything else from the master.
      const source = join(iconDir, size === 16 ? `${name}-16.svg` : `${name}.svg`);
      png(source, join(iconDir, `${name}@${size}.png`), size);
    }
  }
  for (const name of Object.keys(pictures))
    png(
      join(pictureDir, `${name}.svg`),
      join(pictureDir, `${name}@2x.png`),
      name === "news" || name === "diary" ? 1626 : 2048,
    );
}
console.log(`art: ${Object.keys(icons).length} icon files, ${Object.keys(pictures).length} pictures`);
