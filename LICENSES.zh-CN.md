<!-- canonical-source: packages/beijing-fusheng/LICENSES.md -->
<!-- source-sha256: 740b6b0d35c40659d20310c353addfc0215ebdf224f070bb83e96f71a2b116b0 -->

> 英文版为准 ・ 仅供人类参考

# 包里有什么，各归谁

整个包以 GNU 通用公共许可证第 2 版（GPL-2.0，见 LICENSE）发布。这是郭祥昊为他公开的《北京浮生记》源码选择的许可，源码在 [github.com/chrisguo/beijing_fushengji](https://github.com/chrisguo/beijing_fushengji)。

| 部分 | 来源 | 许可 |
|---|---|---|
| `src/`、`kernel/`、`tools/`、`tests/` | 为本包所写；规则照原版游戏，并与作者源码（`SelectionDlg.cpp`）核对过 | GPL-2.0 |
| `art/`（7 枚图标、4 张位图） | 参照原版游戏的图标与图片重画，不含任何原始像素 | GPL-2.0 |
| `data/rules.json`、`data/text.exe.json`、`data/dialogs.json`（游戏的全部文字、数值与表） | 《北京浮生记》V1.2.2 build 0103，Copyright (C) Guoly Computing company, 2001，作者郭祥昊 | GPL-2.0，与作者源码相同 |
| `data/news-and-tips.json`、`public/sound/`（新闻条、开场提示、15 个音效） | 作者源码里的 `Ticker.txt`、`Product/Tips.txt`、`sound/` | GPL-2.0，与作者源码相同 |
| `public/ais6-bridge.js`、`public/kit.css` | AI System 6 应用 kit，原样复制 | 同 kit |
| `preact` | npm | MIT |

## 署名

这个游戏是郭祥昊的。他的名字署在 README、本文件，以及游戏里的「关于本游戏」页（那一页本来就是他的原文）。
