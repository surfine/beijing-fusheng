# What is in this package, and whose it is

| Part | Origin | Licence | Evidence |
|---|---|---|---|
| `src/`, `kernel/`, `tools/`, `tests/` | written for this package | MIT (see LICENSE) | this repository |
| `art/` (seven icons, four pictures) | redrawn for this package after the icons and bitmaps in Beijing.exe; no original pixels are included | MIT for the drawings; the designs follow the original's | `tools/build-art.mjs`, `docs/03-美术bible.md` |
| `data/rules.json`, `data/text.exe.json`, `data/dialogs.json` (every line of the game's text, its numbers and tables) | exported from Beijing.exe, 《北京浮生记》 V1.2.2 build 0103, Copyright (C) Guoly Computing company, 2001, by Guo Xianghao | used with the author's permission; not covered by the MIT licence | the repository owner's word that the author agreed (2026-11); the program's own 特别声明 is dialog 172 in `data/dialogs.json` |
| `public/ais6-bridge.js`, `public/kit.css` | AI System 6 app kit, copied unchanged | as the kit's | `packages/app-kit/` |
| `preact` | npm | MIT | `package.json` |

## Permission

The original is freeware whose own statement (特别声明, items 3 and 4) asks
anyone who distributes or changes it for the author's consent. The owner of
this repository asked Guo Xianghao and has his permission for this port; he
asked to be credited, and is: in the README, in this file, in the licence,
and in the game's own 关于本游戏 page, which is his text.

The permission is for this port. It is not a licence for anyone else to
reuse the game's text or rules; ask the author.
