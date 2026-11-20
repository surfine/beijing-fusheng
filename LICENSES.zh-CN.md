# 包里有什么，各归谁

| 部分 | 来源 | 许可 | 依据 |
|---|---|---|---|
| `src/`、`kernel/`、`tools/`、`tests/` | 为本包所写 | MIT（见 LICENSE） | 本仓库 |
| `art/`（7 枚图标、4 张位图） | 参照 Beijing.exe 里的图标与位图重画，不含任何原始像素 | 画作 MIT；设计沿用原作 | `tools/build-art.mjs`、`docs/03-美术bible.md` |
| `data/rules.json`、`data/text.exe.json`、`data/dialogs.json`（游戏的全部文字、数值与表） | 从 Beijing.exe 导出。《北京浮生记》V1.2.2 build 0103，Copyright (C) Guoly Computing company, 2001，作者郭祥昊 | 经作者同意使用；不在 MIT 许可之内 | 仓库主人转述作者已同意（2026-11）；程序自带的「特别声明」是 `data/dialogs.json` 里的对话框 172 |
| `public/ais6-bridge.js`、`public/kit.css` | AI System 6 应用 kit，原样复制 | 同 kit | `packages/app-kit/` |
| `preact` | npm | MIT | `package.json` |

## 授权

原作是免费软件，它自己的「特别声明」第 3、4 条要求分发或修改者取得作者同意。本仓库的主人问过郭祥昊，这次移植得到了他的同意；他希望署名，署在了：README、本文件、许可证，以及游戏里的「关于本游戏」页（那一页本来就是他的原文）。

这份同意只针对这次移植，不是给其他人重用游戏文字或规则的许可；要用请问作者。
