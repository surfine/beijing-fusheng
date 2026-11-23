import { render } from "preact";
import {
  connect,
  exportFile,
  onAppearance,
  onLanguage,
  onLifecycle,
  onMenuCommand,
  pushMenuState,
  readState,
  setTitle,
  writeState,
} from "./bridge/bridge.ts";
import type { Appearance } from "./bridge/types.ts";
import { Game, type Sheet } from "./game/game.ts";
import { dialog, type Score, windowTitle } from "./game/text.ts";
import { Kernel } from "./kernel/kernel.ts";
import { type Language, translate } from "./strings/index.ts";
import { App, bossDocument, type Translate } from "./ui/App.tsx";
import { ModernApp, modernKeys, type Prefs, type Seen } from "./ui/Modern.tsx";
import "./styles/app.css";
import "./styles/modern.css";

const SAVE_KEY = "save";
const SCORES_KEY = "scores";
const PREFS_KEY = "prefs";
const MEMORY_KEY = "memory";
const LAYOUT_KEY = "layout";
/** The desk's appearances from before Mac OS X: these get the original's layout. */
const CLASSIC_ERAS = new Set(["classic", "system-6", "system-7", "platinum", "drawing-board", "nextstep"]);
const ID = "beijing-fusheng";
/** Menu actions in app.manifest.json that open a slip. */
const SHEETS: Readonly<Record<string, Exclude<Sheet, null>>> = {
  [`${ID}-scores`]: "scores",
  [`${ID}-airport`]: "airport",
  [`${ID}-beijing`]: "beijing",
  [`${ID}-story`]: "story",
  [`${ID}-about`]: "about",
};
const VENUES: Readonly<Record<string, Exclude<Sheet, null>>> = {
  [`${ID}-bank`]: "bank",
  [`${ID}-post`]: "post",
  [`${ID}-hospital`]: "hospital",
  [`${ID}-rent`]: "rent",
  [`${ID}-net`]: "net",
};

function isScores(value: unknown): value is Score[] {
  return (
    Array.isArray(value) &&
    value.length === 10 &&
    value.every(
      (entry) =>
        entry &&
        typeof entry.name === "string" &&
        typeof entry.score === "number" &&
        typeof entry.health === "number" &&
        typeof entry.fame === "string",
    )
  );
}

async function main(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) return;
  const client = await connect();
  let language: Language = client.welcome.language === "zh" ? "zh" : "en";
  const t: Translate = (key, values) => translate(language, key, values);

  // Classic Mac OS appearances get the classic layout, Mac OS X and later the
  // new one, unless the player picked the other in the menu.
  let appearanceId = client.standalone ? "aqua" : (client.welcome.appearance?.id ?? "system-6");
  let override: "classic" | "modern" | null = null;
  const classic = () => (override ?? (CLASSIC_ERAS.has(appearanceId) ? "classic" : "modern")) === "classic";
  const look = (appearance: Appearance | undefined) => {
    if (appearance?.id) appearanceId = appearance.id;
    const dark = appearance ? appearance.colorMode === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.mode = dark ? "dark" : "light";
    if (appearance?.reducedMotion) document.documentElement.dataset.motion = "reduce";
    else delete document.documentElement.dataset.motion;
  };
  look(client.standalone ? undefined : client.welcome.appearance);
  onAppearance(client, (appearance) => {
    look(appearance);
    draw();
  });

  let kernel: Kernel;
  try {
    kernel = await Kernel.load();
  } catch {
    render(<p class="bf-message">{t("kernel_failed")}</p>, root);
    client.ready();
    return;
  }

  const storedScores = await readState(client, SCORES_KEY);
  const storedPrefs = (await readState(client, PREFS_KEY)) as Partial<Prefs> | null;
  let prefs: Prefs = {
    sound: storedPrefs?.sound === true,
    newsPaused: storedPrefs?.newsPaused === true,
    tips: storedPrefs?.tips !== false,
  };
  const storedLayout = await readState(client, LAYOUT_KEY);
  if (storedLayout === "classic" || storedLayout === "modern") override = storedLayout;
  const storedMemory = await readState(client, MEMORY_KEY);
  let memory: Seen[][] =
    Array.isArray(storedMemory) && storedMemory.length === 8
      ? (storedMemory as Seen[][])
      : Array.from({ length: 8 }, () => []);
  let rememberedDay = -1;
  // Price memory: the prices the player has seen, one per good per day.
  const remember = () => {
    const view = game.view;
    if (game.desk.phase === "intro") return;
    const day = 40 - view.daysLeft;
    if (day === rememberedDay) return;
    rememberedDay = day;
    let changed = false;
    view.goods.forEach((goods, item) => {
      if (!goods.price) return;
      const list = memory[item] ?? [];
      const last = list[list.length - 1];
      if (last && last.day === day) return;
      memory[item] = [...list, { day, place: view.location, price: goods.price }].slice(-40);
      changed = true;
    });
    if (changed) void writeState(client, MEMORY_KEY, memory);
  };
  const setPref = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    prefs = { ...prefs, [key]: value };
    void writeState(client, PREFS_KEY, prefs);
    draw();
  };
  const toggleLayout = () => {
    const wasClassic = classic();
    const natural = CLASSIC_ERAS.has(appearanceId) ? "classic" : "modern";
    const next = wasClassic ? "modern" : "classic";
    override = next === natural ? null : next;
    void writeState(client, LAYOUT_KEY, override);
    draw();
  };
  const narrowQuery = matchMedia("(max-width: 699px), (max-width: 949px) and (max-height: 449px)");
  // A seed in the address makes a game repeatable on the app's own page (for tests and screenshots).
  const fixedSeed = Number.parseInt(new URLSearchParams(location.search).get("seed") ?? "", 10);

  let pending = false;
  let savedScores = "";
  let lastTitle = "";
  const game = new Game(
    kernel,
    {
      changed: () => {
        draw();
        if (pending) return;
        pending = true;
        queueMicrotask(() => {
          pending = false;
          void save();
        });
      },
      seed: () => {
        if (Number.isFinite(fixedSeed)) return fixedSeed >>> 0;
        const seed = new Uint32Array(1);
        crypto.getRandomValues(seed);
        return seed[0] ?? 1;
      },
    },
    isScores(storedScores) ? storedScores : null,
  );

  const save = async () => {
    await writeState(client, SAVE_KEY, game.save());
    const scores = JSON.stringify(game.desk.scores);
    if (scores !== savedScores) {
      savedScores = scores;
      await writeState(client, SCORES_KEY, game.desk.scores);
    }
  };

  const title = () => {
    const { desk, view } = game;
    // The boss sees a memo being written, in the title too.
    if (desk.boss) return dialog(168).title;
    if (desk.phase === "intro") return translate(language, "app_title");
    return windowTitle(view.daysLeft);
  };

  const menus = () => {
    const { desk } = game;
    const free = !game.blocked;
    const playing = desk.phase === "play" && free;
    const available: Record<string, boolean> = {
      [`${ID}-new`]: !desk.boss,
      [`${ID}-hacker`]: !desk.boss,
      [`${ID}-boss`]: true,
      "close-active-window": true,
    };
    for (const action of Object.keys(SHEETS)) available[action] = free;
    for (const action of Object.keys(VENUES)) available[action] = playing;
    available[`${ID}-classic`] = !desk.boss;
    pushMenuState(client, { available, checked: { [`${ID}-hacker`]: desk.hacker, [`${ID}-classic`]: classic() } });
  };

  const draw = () => {
    document.documentElement.lang = "zh-CN";
    if (game.desk.phase === "intro") {
      rememberedDay = -1;
      if (memory.some((list) => list.length)) {
        memory = Array.from({ length: 8 }, () => []);
        void writeState(client, MEMORY_KEY, memory);
      }
    } else remember();
    const onSave = () => {
      const memo = bossDocument();
      const name = `${memo.split("\n")[0] ?? "memo"}.txt`;
      void exportFile(client, name, "text/plain", new Blob([memo], { type: "text/plain" }));
    };
    if (!classic()) {
      render(
        <ModernApp
          game={game}
          t={t}
          prefs={prefs}
          setPref={setPref}
          memory={memory}
          onClassic={toggleLayout}
          onSave={onSave}
        />,
        root,
      );
    } else
      render(
        <App
          game={game}
          t={t}
          narrow={narrowQuery.matches}
          onSave={() => {
            const memo = bossDocument();
            const name = `${memo.split("\n")[0] ?? "memo"}.txt`;
            void exportFile(client, name, "text/plain", new Blob([memo], { type: "text/plain" }));
          }}
        />,
        root,
      );
    const next = title();
    if (next !== lastTitle) {
      lastTitle = next;
      setTitle(client, next);
      document.title = next;
    }
    menus();
  };

  game.load(await readState(client, SAVE_KEY));
  savedScores = JSON.stringify(game.desk.scores);

  onMenuCommand(client, (action) => {
    const sheet = SHEETS[action];
    const venue = VENUES[action];
    if (action === `${ID}-new`) game.askNewGame();
    else if (action === `${ID}-hacker`) game.toggleHacker();
    else if (action === `${ID}-boss`) game.boss(!game.desk.boss);
    else if (action === `${ID}-classic`) toggleLayout();
    else if (sheet) game.open(sheet);
    else if (venue) game.enter(venue);
    else return false;
    return true;
  });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const { desk } = game;
    // An open native dialog (the new layout's sheets) handles its own Esc.
    if (document.querySelector("dialog[open]")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (desk.boss) game.boss(false);
      else if (desk.sheet) game.close();
      else game.boss(true);
      return;
    }
    if (desk.boss || desk.phase !== "play") return;
    const target = event.target;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    if (event.key === "Enter" && typing && !desk.sheet && desk.selected >= 0) {
      event.preventDefault();
      game.buy();
      return;
    }
    if (typing || game.blocked || desk.sheet) return;
    if (!classic()) {
      if (modernKeys(game, t, event)) event.preventDefault();
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "b") game.buy();
    else if (key === "s") game.sell();
    else if (key === "m") game.buy(true);
    else if (key === "a") game.sell(true);
    else if (key === "g") game.toggleGround();
    else if (key === "arrowleft" || key === "arrowright") {
      // Between the market and the room, on the same goods.
      const side = key === "arrowright" ? ".bf-room" : ".bf-market";
      const row =
        document.querySelector<HTMLElement>(`${side} [data-item="${desk.selected}"]`) ??
        document.querySelector<HTMLElement>(`${side} .bf-row`);
      row?.focus();
    } else return;
    event.preventDefault();
  });

  narrowQuery.addEventListener("change", draw);
  if (client.standalone) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => look(undefined));

  // The desk asks before it closes or hides the window. Every change is saved
  // as it happens, so there is only the last write to wait for.
  onLifecycle(client, {
    suspend: async () => {
      await save();
    },
    resume: () => draw(),
    dispose: () => {},
  });
  onLanguage(client, (next) => {
    language = next;
    lastTitle = "";
    draw();
  });
  client.enableSnapshots({ producer: "dom", target: root });
  draw();
  // First paint is done: the desk stops its loading state and takes the first picture.
  client.ready();
}

void main();
