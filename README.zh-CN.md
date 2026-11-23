<!-- canonical-source: packages/beijing-fusheng/README.md -->
<!-- source-sha256: 5d9bb62065902eb6e31c6b47abd827f5d7c09f1af9dfea2b1d71afdcd16c405a -->

> 英文版为准 ・ 仅供人类参考

# 北京浮生记

AI System 6 的一个应用：2001 年的 Windows 共享软件《北京浮生记》（Beijing.exe V1.2.2 build 0103），规则和文案照原样，跑在桌面的一个窗口里。

**这个游戏是郭祥昊的（Guoly Computing，2001）。** 您在里面读到的每一个字、每一个价格、每一件事、每一句玩笑，都是他写的。本包是一次移植：规则照他的程序重写，文字一个字没改地搬过来，图是照他的图重画的。这里新做的只有工程和版面。

<p><img src="screenshots/beijing-fusheng-classic.png" width="49%" alt="北京浮生记 · Classic"> <img src="screenshots/beijing-fusheng-liquid-glass.png" width="49%" alt="北京浮生记 · 新版面，用于 Mac OS X 及之后的外观"></p>

<p><img src="screenshots/beijing-fusheng-ledger.png" width="49%" alt="第 0 天的账本：黑市、出租屋和五个数"> <img src="screenshots/beijing-fusheng-news.png" width="49%" alt="北京新闻一页取代交易台"></p>
<p><img src="screenshots/beijing-fusheng-dark.png" width="74%" alt="深色模式下的新版面"> <img src="screenshots/beijing-fusheng-phone.png" width="24%" alt="手机宽度 390 点的新版面：一张表"></p>

两种版面。桌面用 Classic Mac OS 的外观（System 6、System 7、Platinum）时，窗口就是 2001 年原程序的样子：蓝底、黄字、四种颜色。用 Mac OS X 及之后的外观时，是围绕同一批对象的现代界面：黑市和出租屋左右并排，买进、卖出两个箭头在中间，下面是您的状态、十个站名按钮组成的地铁示意图、五个办事机构和新闻条。手机宽度下两张表合成一张。「系统」菜单里的「经典版面」可以切换。

您从家乡来到北京，身上 2000 元，欠村长的债每天涨一成。四十天里，在二环十个地铁站之间倒卖八种灰色商品。

- `kernel/`：规则。Rust 编译成 12 KB 的 WebAssembly，没有任何导入。同一颗种子、同一串命令，得到逐字节相同的快照。
- `data/`：价格区间、三张事件表和全部原文，取自原程序，每一条规则都写明它在作者源码里的表或函数。
- `src/`：界面（TypeScript 与 Preact），不含规则。
- `art/`：7 枚图标、4 张位图，矢量母版。
- `docs/`：设计文档：审计、三个方向、美术 bible、规格、内核契约、关键画面、远期备忘、自检表。

游戏原文是简体中文，不翻译、不改字。桌面的菜单和本应用加的少量标注有中英两种。

## 命令

```bash
npm install
npm run dev          # 在自己的页面上跑（加 ?seed=1&lang=zh 可重现一局）
npm run check        # 类型、lint、测试、构建、ais6-app check
npm run kernel       # rules.json → tables.rs → wasm → src/kernel/kernel.wasm.ts（需要 Rust）
npm run kernel:test  # 内核自己的测试（cargo）
npm run art          # 重写 art/（导出 PNG 需要 rsvg-convert）
```

## 在桌面里

声明的能力：`state`、`files`、`appearance`、`snapshot`；不用任何服务。每走一步都经 `state.*` 存档；老板画面的「存 盘」经 `files.export` 存出一份文本。

本机桌面开着时：`npx ais6-app install . --desk <网址>`，再到「应用程序 → 取得更多」里批准。

## 许可与署名

GPL-2.0，与作者公开的源码（[chrisguo/beijing_fushengji](https://github.com/chrisguo/beijing_fushengji)）同一许可。游戏的文字、规则与数值属于郭祥昊。见 [LICENSES.zh-CN.md](LICENSES.zh-CN.md)。
