// 北京浮生记 for the desk's later appearances (Mac OS X and after): the
// original's objects in a current interface. 黑市 and 您的出租屋 side by side
// with the two arrows between, 您的状态, the ten stations as the buttons of
// the 地铁示意图, the five offices and the news line. On a phone the two
// tables become one, and a row opens to trade. Rules and words are the
// kernel's and the original's; this file only lays them out.

import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import extras from "../../data/news-and-tips.json";
import type { Game, Sheet } from "../game/game.ts";
import {
  dialog,
  endingLines,
  fameCost,
  fameName,
  goodsName,
  ITEM_COUNT,
  type Page,
  placeName,
  refusalText,
  rules,
  sprintf,
  text,
} from "../game/text.ts";
import { Ending, Venue, type View } from "../kernel/kernel.ts";
import { Boss, type Translate } from "./App.tsx";
import { Icon } from "./Art.tsx";

/** One price as the player saw it. */
export interface Seen {
  readonly day: number;
  readonly place: number;
  readonly price: number;
}

/** What the player chose about this layout; kept in the app's state. */
export interface Prefs {
  readonly sound: boolean;
  readonly newsPaused: boolean;
  readonly tips: boolean;
}

interface Props {
  readonly game: Game;
  readonly t: Translate;
  readonly prefs: Prefs;
  readonly setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  /** The last forty prices seen of each good, oldest first. */
  readonly memory: readonly (readonly Seen[])[];
  readonly onClassic: () => void;
  readonly onSave: () => void;
}

const fmt = (n: number): string => (n < 0 ? "−" : "") + Math.abs(Math.trunc(n)).toLocaleString("en-US");
const main = dialog(129);
/** A label of the original's main window by how it begins, without spaces or colons. */
const label = (prefix: string): string =>
  (main.lines.find((line) => line.startsWith(prefix)) ?? prefix).replace(/[：:]$/, "").replace(/\s+/g, "");
const button = (id: number): string => (main.buttons[id] ?? "").replace(/\s+/g, "");
const reduced = (): boolean =>
  document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const ledger = (v: View): number => v.cash + v.deposit - v.debt + v.goods.reduce((s, g) => s + g.quantity * g.cost, 0);

// ---- sound: the original's own wav files, off until the player turns them on ----------

let soundOn = false;
function play(name: string): void {
  if (!soundOn) return;
  try {
    const audio = new Audio(`./sound/${name}`);
    audio.volume = 0.6;
    void audio.play().catch(() => {});
  } catch {
    // no audio here
  }
}
function pageSound(page: Page): string | null {
  const first = page.lines[0] ?? "";
  return rules.health.find((h) => h.text && first.startsWith(h.text))?.sound ?? null;
}

// ---- what the interface remembers between draws (not saved) ---------------------------

const ui: { yesterday: number | null; done: { item: number; text: string } | null; tipShown: boolean } = {
  yesterday: null,
  done: null,
  tipShown: false,
};

/** The ten stations laid out as the original's 地铁示意图: [place, row, column], west to east. */
const STATIONS: ReadonlyArray<readonly [number, number, number]> = [
  [10, 2, 1],
  [9, 2, 2],
  [6, 2, 3],
  [8, 3, 3],
  [3, 1, 3],
  [7, 1, 4],
  [4, 3, 4],
  [5, 1, 5],
  [1, 2, 5],
  [2, 3, 5],
];
const OFFICES: ReadonlyArray<readonly [Exclude<Sheet, null>, number]> = [
  ["bank", 1084],
  ["hospital", 1085],
  ["post", 1086],
  ["rent", 1087],
  ["net", 1088],
];

// ---- line icons: one family, current colour ------------------------------------------

const ICON_PATHS: Readonly<Record<string, ComponentChildren>> = {
  bank: (
    <>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" />
      <path d="M3 20h18" />
    </>
  ),
  hospital: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  post: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="m4 7.5 8 6 8-6" />
    </>
  ),
  rent: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  net: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </>
  ),
};
function Line({ name }: { name: string }) {
  return (
    <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

// ---- the price memory: the last twelve prices seen, no axis, no forecast -------------

function Spark({ list, t }: { list: readonly Seen[]; t: Translate }) {
  const xs = list.slice(-12);
  if (xs.length < 2) return null;
  const prices = xs.map((p) => p.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const x = (i: number) => 2 + (i * 52) / (xs.length - 1);
  const y = (v: number) => (hi === lo ? 8 : 14 - ((v - lo) * 12) / (hi - lo));
  const last = xs[xs.length - 1]?.price ?? 0;
  return (
    <svg
      class="spark"
      viewBox="0 0 56 16"
      role="img"
      aria-label={t("m_seen_label", { count: xs.length, low: fmt(lo), high: fmt(hi) })}
    >
      <polyline points={xs.map((p, i) => `${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ")} />
      <circle class="now" cx={x(xs.length - 1)} cy={y(last)} r="2.4" />
    </svg>
  );
}

// ---- the whole app ------------------------------------------------------------------

export function ModernApp(props: Props) {
  const { game, prefs } = props;
  const { desk } = game;
  soundOn = prefs.sound;
  const [local, setLocal] = useState<"menu" | "tips" | null>(null);
  if (desk.boss) return <Boss game={game} onSave={props.onSave} />;
  const over = desk.phase === "over" && !desk.pages.length;
  if (desk.phase === "intro" && prefs.tips && !ui.tipShown && extras.tips.length && local === null) {
    ui.tipShown = true;
    queueMicrotask(() => setLocal("tips"));
  }
  return (
    <div class="bfm">
      <div class="screen">
        {desk.phase === "intro" ? (
          <Intro {...props} />
        ) : over ? (
          <EndingView {...props} />
        ) : (
          <Desk {...props} openMenu={() => setLocal("menu")} />
        )}
      </div>
      {local === "menu" ? <MenuSheet {...props} close={() => setLocal(null)} /> : null}
      {local === "tips" ? <TipSheet {...props} close={() => setLocal(null)} /> : null}
      {desk.sheet && local === null ? <GameSheet {...props} /> : null}
    </div>
  );
}

// ---- the desk --------------------------------------------------------------------------

function trade(game: Game, t: Translate, kind: "buy" | "sell", all = false): void {
  const i = game.desk.selected;
  const before = game.view;
  const g0 = before.goods[i];
  if (kind === "buy") game.buy(all);
  else game.sell(all);
  if (i < 0 || !g0) return;
  const after = game.view;
  const n = Math.abs((after.goods[i]?.quantity ?? 0) - g0.quantity);
  if (!n) return;
  const name = goodsName(i);
  if (kind === "buy") {
    ui.done = { item: i, text: t("m_bought", { count: fmt(n), name, amount: fmt(before.cash - after.cash) }) };
    play("buy.wav");
  } else {
    const got = after.cash - before.cash;
    const pl = got - n * g0.cost;
    const values = { count: fmt(n), name, amount: fmt(got), diff: fmt(Math.abs(pl)) };
    ui.done = { item: i, text: t(pl > 0 ? "m_sold_gain" : pl < 0 ? "m_sold_loss" : "m_sold_even", values) };
    play("money.wav");
  }
  game.select(i);
}

function travel(game: Game, place: number): void {
  const v = game.view;
  if (game.blocked || game.desk.phase !== "play" || place === v.location) return;
  const before = ledger(v);
  game.go(place);
  const after = game.view;
  if (after.daysLeft === v.daysLeft) return;
  ui.yesterday = ledger(after) - before;
  ui.done = null;
  play("shutdoor.wav");
}

function Desk(props: Props & { openMenu: () => void }) {
  const { game, t } = props;
  const { desk, view: v } = game;
  const playing = desk.phase === "play";
  const can = playing && !game.blocked;
  const gone = 40 - v.daysLeft;
  const day = Math.min(40, gone + 1);
  const page = desk.pages[0];
  const full = v.used >= v.capacity;
  const room = <span class={full ? "full" : undefined}>{`${v.used}/${v.capacity}`}</span>;
  const yesterday =
    ui.yesterday !== null && playing
      ? t("m_yesterday", { amount: `${ui.yesterday >= 0 ? "+" : ""}${fmt(ui.yesterday)}` })
      : "";
  const sel = desk.selected >= 0 ? v.goods[desk.selected] : undefined;
  const most = sel?.price ? game.maxBuy(desk.selected) : 0;
  const done = ui.done && ui.done.item === desk.selected ? ui.done.text : "";
  const why = sel?.price && most < 0 ? (refusalText(-most, v, desk.selected) ?? "") : "";
  const say = desk.notice ?? [done, why].filter(Boolean).join("　");

  useEffect(() => {
    if (page) {
      const sound = pageSound(page);
      if (sound) play(sound);
    }
  }, [page]);

  const name = (i: number) => {
    const g = v.goods[i];
    const mark = desk.marks[i];
    const fame = fameCost(i);
    return (
      <>
        {goodsName(i)}
        {mark === "up" ? <span class="tag up">暴涨</span> : mark === "down" ? <span class="tag down">暴跌</span> : null}
        {fame && g?.price && (desk.selected === i || g.quantity) ? (
          <span class="tag law">{sprintf("卖出扣 %d 点名声", fame)}</span>
        ) : null}
      </>
    );
  };
  const diff = (i: number) => {
    const g = v.goods[i];
    if (!g?.price) return null;
    const x = g.price - g.cost;
    return x ? <span class={`pl ${x > 0 ? "up" : "down"}`}>{`${x > 0 ? "+" : ""}${fmt(x)}`}</span> : null;
  };
  const items = Array.from({ length: ITEM_COUNT }, (_, i) => i);
  const pick = (i: number) => game.select(i);

  return (
    <div class={`desk${page ? " paged" : ""}`}>
      <header class="bar">
        <div class="titles">
          <h1>{t("m_day", { day })}</h1>
          <span>{v.location ? placeName(v.location, v.ground) : t("m_arrived")}</span>
        </div>
        <div class="days">
          <div
            class="track"
            role="progressbar"
            aria-label={t("day_of", { day })}
            aria-valuemin={0}
            aria-valuemax={40}
            aria-valuenow={gone}
          >
            <div class="fill" style={{ transform: `scaleX(${gone / 40})` }} />
          </div>
          <span class="n">{t("m_days_left", { count: v.daysLeft })}</span>
          <p class="yesterday">{yesterday}</p>
        </div>
      </header>

      <section class="status" aria-labelledby="bfm-status">
        <h2 id="bfm-status">{button(-1)}</h2>
        <dl class="five">
          <div>
            <dt>{label("现")}</dt>
            <dd>{fmt(v.cash)}</dd>
          </div>
          <div>
            <dt>{label("存款")}</dt>
            <dd>{fmt(v.deposit)}</dd>
          </div>
          <div class="debt">
            <dt>{label("欠")}</dt>
            <dd>{fmt(v.debt)}</dd>
            <span class="grow n">
              {v.debt ? t("m_tomorrow", { amount: fmt(Math.floor((v.debt * 11) / 10) - v.debt) }) : ""}
            </span>
          </div>
          <div class={v.health < 85 ? "warn" : undefined}>
            <dt>{label("健康")}</dt>
            <dd>{v.health}</dd>
          </div>
          <div class="word">
            <dt>{label("名声")}</dt>
            <dd>{fameName(v.fame)}</dd>
          </div>
        </dl>
        <p class="meta" aria-live="polite">
          <span class="yesterday">{yesterday}</span>
          <span class="roomline">
            {label("您的出租屋")} {room}
          </span>
        </p>
      </section>

      <nav class={`stations${v.ground ? " above" : ""}`} aria-labelledby="bfm-stations">
        <div class="sthead">
          <h2 id="bfm-stations">{v.ground ? text.mapGround : button(1120)}</h2>
          <fieldset class="mapseg" aria-label={t("m_map")}>
            {[false, true].map((ground) => (
              <button
                key={String(ground)}
                type="button"
                aria-pressed={v.ground === ground}
                disabled={!can}
                onClick={() => {
                  if (v.ground !== ground) game.toggleGround();
                }}
              >
                {t(ground ? "m_ground" : "m_subway")}
              </button>
            ))}
          </fieldset>
        </div>
        <div class="grid">
          <i class="ring" aria-hidden="true" />
          <i class="l1" aria-hidden="true" />
          {STATIONS.map(([p, r, c]) => (
            <button
              key={p}
              data-place={p}
              type="button"
              style={{ gridArea: `${r} / ${c}` }}
              aria-current={p === v.location ? "location" : undefined}
              disabled={!can}
              onClick={() => travel(game, p)}
            >
              {placeName(p, v.ground)}
            </button>
          ))}
        </div>
      </nav>

      {/* one table (phone): the market and the room together; a row opens to trade */}
      <section class="goods">
        <table>
          <thead>
            <tr>
              <th scope="col" class="cap">
                {label("黑")}
              </th>
              <th scope="col">{t("m_price")}</th>
              <th scope="col">{t("m_held")}</th>
              <th scope="col">{t("m_paid")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const g = v.goods[i];
              if (!g) return null;
              const open = desk.selected === i;
              const rowMost = g.price ? game.maxBuy(i) : 0;
              return (
                <PhoneRow
                  key={i}
                  {...props}
                  i={i}
                  open={open}
                  most={rowMost}
                  name={name(i)}
                  diff={diff(i)}
                  playing={playing}
                />
              );
            })}
          </tbody>
        </table>
      </section>

      {/* two tables (wide): 黑市 on the left, 您的出租屋 on the right, the arrows between */}
      <section class="trade">
        <div class="market">
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col" class="cap">
                    {label("黑")}
                  </th>
                  <th scope="col">{t("m_price")}</th>
                  <th scope="col">
                    <span class="vh">{t("m_seen")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const g = v.goods[i];
                  if (!g) return null;
                  return (
                    <tr
                      key={i}
                      data-item={i}
                      class={g.price ? undefined : "out"}
                      aria-selected={desk.selected === i}
                      onClick={() => pick(i)}
                      onDblClick={() => {
                        pick(i);
                        trade(game, t, "buy", true);
                      }}
                    >
                      <td>{name(i)}</td>
                      <td class="price">{g.price ? fmt(g.price) : "—"}</td>
                      <td class="trend">{g.price ? <Spark list={props.memory[i] ?? []} t={t} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div class="arrows">
          <button
            type="button"
            class="act buy"
            disabled={!can || !sel?.price || most <= 0}
            onClick={() => trade(game, t, "buy")}
          >
            {label("买")} →
          </button>
          <label class="qty">
            <span>{t("quantity")}</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder={t("m_all")}
              value={desk.quantity}
              disabled={!can}
              onInput={(event) => game.setQuantity(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  trade(game, t, "buy");
                }
              }}
            />
          </label>
          <button
            type="button"
            class="act sell"
            disabled={!can || !sel?.price || !sel.quantity}
            onClick={() => trade(game, t, "sell")}
          >
            ← {label("卖")}
          </button>
        </div>
        <div class="roomt">
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col" class="cap">
                    {label("您的出租屋")}
                    <span>{room}</span>
                  </th>
                  <th scope="col">{t("m_paid")}</th>
                  <th scope="col">{t("m_diff")}</th>
                  <th scope="col">{t("quantity")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const g = v.goods[i];
                  if (!g?.quantity) return null;
                  return (
                    <tr
                      key={i}
                      data-item={i}
                      aria-selected={desk.selected === i}
                      onClick={() => pick(i)}
                      onDblClick={() => {
                        pick(i);
                        trade(game, t, "sell", true);
                      }}
                    >
                      <td>{goodsName(i)}</td>
                      <td class="cost">{fmt(g.cost)}</td>
                      <td class="diff">{diff(i)}</td>
                      <td class="held">{g.quantity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {v.used ? null : <p class="empty">{t("m_room_empty")}</p>}
          </div>
        </div>
        <p class={`say${!desk.notice && done ? " ok" : ""}`} aria-live="polite">
          {say}
        </p>
      </section>

      {page ? <PageView {...props} page={page} /> : null}

      <nav class="offices" aria-label={t("m_offices")}>
        {OFFICES.map(([sheet, id]) => (
          <button
            key={sheet}
            type="button"
            disabled={!can}
            onClick={() => {
              if (sheet === "bank" || sheet === "hospital" || sheet === "post") play("opendoor.wav");
              game.enter(sheet);
            }}
          >
            <Line name={sheet} />
            <span>{button(id)}</span>
          </button>
        ))}
        <button type="button" onClick={props.openMenu}>
          <Line name="more" />
          <span>{t("m_more")}</span>
        </button>
      </nav>

      <Ticker {...props} />
    </div>
  );
}

function PhoneRow(
  props: Props & {
    i: number;
    open: boolean;
    most: number;
    name: ComponentChildren;
    diff: ComponentChildren;
    playing: boolean;
  },
) {
  const { game, t, i, open, most } = props;
  const g = game.view.goods[i];
  if (!g) return null;
  const desk = game.desk;
  const done = ui.done && ui.done.item === i ? ui.done.text : "";
  const why = g.price && most < 0 ? (refusalText(-most, game.view, i) ?? "") : "";
  const say = desk.notice ?? [done, why].filter(Boolean).join("　");
  const facts = !g.price ? "今天没货" : most > 0 ? t("m_can_buy", { count: fmt(most) }) : "";
  const free = props.playing && !game.blocked;
  return (
    <>
      <tr
        class={`row${g.price ? "" : " out"}`}
        data-item={i}
        aria-selected={open}
        aria-expanded={open}
        onClick={() => game.select(open ? -1 : i)}
      >
        <td>
          <span class="name">{props.name}</span>
        </td>
        <td class="price">
          <span class="p">{g.price ? fmt(g.price) : "—"}</span>
          {g.price ? <Spark list={props.memory[i] ?? []} t={t} /> : null}
        </td>
        <td class="held">{g.quantity || ""}</td>
        <td class="cost">
          {g.quantity ? fmt(g.cost) : ""}
          {g.quantity ? props.diff : null}
        </td>
      </tr>
      <tr class={`deal${open ? " open" : ""}`}>
        <td colSpan={4}>
          <div class="deal-wrap">
            <div class="deal-in">
              {open ? (
                <div class="deal-box">
                  {say ? <p class={`say${!desk.notice && done ? " ok" : ""}`}>{say}</p> : null}
                  <span class="facts">{facts}</span>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    enterKeyHint="done"
                    aria-label={t("quantity")}
                    placeholder={t("m_all")}
                    value={desk.quantity}
                    onInput={(event) => game.setQuantity(event.currentTarget.value)}
                  />
                  <button
                    type="button"
                    class="act buy"
                    disabled={!free || !g.price || most <= 0}
                    onClick={() => trade(game, t, "buy")}
                  >
                    {label("买")}
                  </button>
                  <button
                    type="button"
                    class="act sell"
                    disabled={!free || !g.price || !g.quantity}
                    onClick={() => trade(game, t, "sell")}
                  >
                    {label("卖")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

/** The day's news or diary page takes the trading area's place until it is read. */
function PageView({ game, t, page }: Props & { page: Page }) {
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ok.current?.focus({ preventScroll: true });
  }, [page]);
  const v = game.view;
  const news = page.kind === "news";
  const paper = dialog(news ? 138 : 142);
  const rest = game.desk.pages.length - 1;
  return (
    <section class={`page ${news ? "news" : "diary"}`} aria-label={paper.title}>
      <div class="strip">{paper.title}</div>
      <div class="body">
        {page.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <button ref={ok} class="ok" type="button" onClick={() => game.turnPage()}>
          {paper.buttons[1]}
        </button>
        {rest > 0 ? <span class="more">{t("m_pages_left", { count: rest })}</span> : null}
      </div>
    </section>
  );
}

// The news line works like a station's LED sign: one headline at a time stops
// for seven seconds; one wider than the sign then creeps on to its end. The
// pointer or the pause button holds it; with reduced motion it only swaps.
function Ticker({ t, prefs, setPref }: Props) {
  const line = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const held = useRef(false);
  const paused = useRef(prefs.newsPaused);
  paused.current = prefs.newsPaused;
  useEffect(() => {
    let alive = true;
    let timer = 0;
    let index = 0;
    const hold = () => held.current || paused.current || document.hidden;
    const wait = (ms: number) =>
      new Promise<void>((done) => {
        const go = () => {
          if (!alive) return;
          timer = window.setTimeout(hold() ? go : done, hold() ? 400 : ms);
        };
        go();
      });
    const creep = (el: HTMLElement, to: number) =>
      new Promise<void>((done) => {
        if (reduced()) {
          el.style.transform = `translateX(${to}px)`;
          done();
          return;
        }
        let x = 0;
        let last = performance.now();
        const step = (now: number) => {
          if (!alive) return;
          const dt = Math.min(64, now - last);
          last = now;
          if (!hold()) x = Math.max(to, x - (30 * dt) / 1000);
          el.style.transform = `translateX(${x}px)`;
          if (x > to) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
    const run = async () => {
      while (alive) {
        const el = line.current;
        const view = box.current;
        const item = extras.ticker[index++ % extras.ticker.length];
        if (!el || !view || !item) return;
        el.replaceChildren(item[0] ?? "", Object.assign(document.createElement("b"), { textContent: item[1] ?? "" }));
        el.style.transform = "translateX(0)";
        await wait(7000);
        const over = el.scrollWidth - (view.clientWidth - 12);
        if (over > 0 && alive) {
          await creep(el, -over);
          await wait(2500);
        }
      }
    };
    if (extras.ticker.length) void run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  return (
    <div
      class={`ticker${prefs.newsPaused ? " paused" : ""}`}
      role="marquee"
      aria-label={t("m_news")}
      onPointerEnter={() => {
        held.current = true;
      }}
      onPointerLeave={() => {
        held.current = false;
      }}
    >
      <span class="lbl">{t("m_news")}</span>
      <div class="view" ref={box}>
        <span class="line" ref={line} />
      </div>
      <button
        type="button"
        aria-label={t(prefs.newsPaused ? "m_news_play" : "m_news_pause")}
        onClick={() => setPref("newsPaused", !prefs.newsPaused)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect class="ps" x="4" y="3" width="2.6" height="10" />
          <rect class="ps" x="9.4" y="3" width="2.6" height="10" />
          <path class="pl" d="M5 3 L13 8 L5 13 Z" />
        </svg>
      </button>
    </div>
  );
}

// ---- sheets: the original's modal boxes as native dialogs ------------------------------

function SheetFrame({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon?: ComponentChildren;
  onClose: () => void;
  children: ComponentChildren;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const shut = useRef(onClose);
  shut.current = onClose;
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // A tap on the dimmed backdrop closes the sheet; Esc does through "cancel".
    const backdrop = (event: MouseEvent) => {
      if (event.target === d) shut.current();
    };
    d?.addEventListener("click", backdrop);
    const first = d?.querySelector<HTMLElement>("input, .btn.primary");
    first?.focus();
    return () => d?.removeEventListener("click", backdrop);
  }, []);
  return (
    <dialog
      ref={ref}
      class="sheet"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div class="sheet-body">
        <div class="grabber" aria-hidden="true" />
        <h2>
          {icon}
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </>
  );
}

function AmountField({
  label: name,
  most,
  value,
  setValue,
}: {
  label: string;
  most: number;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <>
      <label class="field">
        {name}
        <input
          inputMode="numeric"
          enterKeyHint="done"
          value={value}
          onInput={(event) => setValue(event.currentTarget.value.replace(/\D/g, "").slice(0, 9))}
        />
      </label>
      <div class="presets">
        <button type="button" onClick={() => setValue(String(Math.max(1, Math.floor(most / 4))))}>
          四分之一
        </button>
        <button type="button" onClick={() => setValue(String(Math.max(1, Math.floor(most / 2))))}>
          一半
        </button>
        <button type="button" onClick={() => setValue(String(most))}>
          全部 {fmt(most)}
        </button>
      </div>
    </>
  );
}

function ScoreTable({ game, t }: { game: Game; t: Translate }) {
  const { view, desk } = game;
  const mine = view.ending === Ending.ranked && desk.phase === "over" ? view.rank - 1 : -1;
  return (
    <div style={{ overflowX: "auto" }}>
      <table class="scores">
        <thead>
          <tr>
            <th scope="col">{t("place")}</th>
            <th scope="col">{t("name")}</th>
            <th scope="col" class="r">
              {t("money")}
            </th>
            <th scope="col" class="r">
              {text.healthLabel}
            </th>
            <th scope="col">{label("名声")}</th>
          </tr>
        </thead>
        <tbody>
          {desk.scores.map((s, place) => (
            <tr key={place} class={place === mine ? "me" : undefined}>
              <td>{text.ranks[place]}</td>
              <td>{s.name}</td>
              <td class="r">{fmt(s.score)}</td>
              <td class="r">{s.health}</td>
              <td>{s.fame}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GameSheet({ game, t }: Props) {
  const v = game.view;
  const s = game.desk.sheet;
  const [amount, setAmount] = useState("");
  const close = () => game.close();
  const num = (most: number) => {
    const n = Number.parseInt(amount, 10);
    return Number.isFinite(n) && n > 0 ? n : most;
  };
  const shut = (text_: string | undefined) => (
    <div class="btns">
      <button class="btn primary" type="button" onClick={close}>
        {text_}
      </button>
    </div>
  );
  switch (s) {
    case "bank": {
      const d = dialog(133);
      const most = Math.max(v.cash, v.deposit);
      return (
        <SheetFrame title={d.title} icon={<Line name="bank" />} onClose={close}>
          <p>{sprintf(text.bankAsk, v.cash, v.deposit)}</p>
          <AmountField label={t("amount")} most={most} value={amount || String(most)} setValue={setAmount} />
          <div class="btns">
            <button class="btn" type="button" onClick={close}>
              {d.buttons[1111]}
            </button>
            <button
              class="btn"
              type="button"
              disabled={v.deposit < 1}
              onClick={() => game.visit(Venue.withdraw, Math.min(num(most), v.deposit), true)}
            >
              {d.buttons[2]}
            </button>
            <button
              class="btn primary"
              type="button"
              disabled={v.cash < 1}
              onClick={() => game.visit(Venue.deposit, Math.min(num(most), v.cash), true)}
            >
              {d.buttons[1]}
            </button>
          </div>
        </SheetFrame>
      );
    }
    case "hospital": {
      const d = dialog(135);
      const need = 100 - v.health;
      const most = Math.max(1, Math.min(need, Math.floor(v.cash / rules.hospital.pricePerPoint)));
      return (
        <SheetFrame title={d.title} icon={<Line name="hospital" />} onClose={close}>
          <p>{sprintf(text.hospitalAsk, v.health, need) + (d.lines[0] ?? "")}</p>
          <AmountField label={d.lines[1] ?? ""} most={most} value={amount || String(most)} setValue={setAmount} />
          <div class="btns">
            <button class="btn" type="button" onClick={close}>
              {d.buttons[2]}
            </button>
            <button
              class="btn primary"
              type="button"
              onClick={() => game.visit(Venue.hospital, Math.min(num(most), need))}
            >
              {d.buttons[1]}
            </button>
          </div>
        </SheetFrame>
      );
    }
    case "post": {
      const d = dialog(136);
      const most = Math.max(1, Math.min(v.cash, v.debt));
      return (
        <SheetFrame title={d.title} icon={<Line name="post" />} onClose={close}>
          <p>{sprintf(text.villageOwe, v.debt)}</p>
          <AmountField label={d.lines[0] ?? ""} most={most} value={amount || String(most)} setValue={setAmount} />
          <div class="btns">
            <button class="btn" type="button" onClick={close}>
              {d.buttons[2]}
            </button>
            <button
              class="btn primary"
              type="button"
              onClick={() => game.visit(Venue.post, Math.min(num(most), v.debt))}
            >
              {d.buttons[1]}
            </button>
          </div>
        </SheetFrame>
      );
    }
    case "rent": {
      const d = dialog(163);
      return (
        <SheetFrame title={d.title} icon={<Line name="rent" />} onClose={close}>
          <Lines lines={[...d.lines, sprintf(text.rentSmall, v.capacity), game.rentQuoteLine()]} />
          <div class="btns">
            <button class="btn" type="button" onClick={() => game.visit(Venue.rent, 0)}>
              {d.buttons[2]}
            </button>
            <button class="btn primary" type="button" onClick={() => game.visit(Venue.rent, 1)}>
              {d.buttons[1]}
            </button>
          </div>
        </SheetFrame>
      );
    }
    case "net": {
      const d = dialog(160);
      return (
        <SheetFrame title={d.title} icon={<Line name="net" />} onClose={close}>
          <p>{d.lines[0]}</p>
          <ul class="list">
            {d.lines.slice(1).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div class="btns">
            <button class="btn primary" type="button" onClick={() => game.visit(Venue.net)}>
              {d.buttons[1]}
            </button>
          </div>
        </SheetFrame>
      );
    }
    case "airport": {
      const d = dialog(145);
      return (
        <SheetFrame title={d.title} onClose={close}>
          <Lines lines={d.lines.map((l) => l.trim())} />
          {shut(d.buttons[1])}
        </SheetFrame>
      );
    }
    case "scores": {
      const d = dialog(137);
      return (
        <SheetFrame title={d.title} onClose={close}>
          <p>{d.lines[0]}</p>
          <ScoreTable game={game} t={t} />
          {shut(d.buttons[1])}
        </SheetFrame>
      );
    }
    case "about": {
      const d = dialog(100);
      return (
        <SheetFrame title={d.title} icon={<Icon name="city" size={30} />} onClose={close}>
          <Lines lines={d.lines} />
          <p>
            {d.buttons[1121]}：{dialog(171).lines[0]}
          </p>
          <p>{text.authorNote}</p>
          <div class="btns">
            <button class="btn" type="button" onClick={() => game.open("statement")}>
              {d.buttons[1122]}
            </button>
            <button class="btn primary" type="button" onClick={close}>
              {d.buttons[1]}
            </button>
          </div>
        </SheetFrame>
      );
    }
    case "statement": {
      const d = dialog(172);
      return (
        <SheetFrame title={d.lines[0] ?? ""} onClose={close}>
          <Lines lines={d.lines.slice(1)} />
          {shut(d.buttons[1])}
        </SheetFrame>
      );
    }
    case "story": {
      const d = dialog(166);
      return (
        <SheetFrame title={d.lines[0] ?? ""} icon={<Line name="bulb" />} onClose={close}>
          <Lines lines={d.lines.slice(1).map((l) => l.trim())} />
          {shut(dialog(167).buttons[1])}
        </SheetFrame>
      );
    }
    case "beijing": {
      const d = dialog(167);
      return (
        <SheetFrame title={d.lines[0] ?? ""} onClose={close}>
          <Lines lines={d.lines.slice(1).map((l) => l.trim())} />
          {shut(d.buttons[1])}
        </SheetFrame>
      );
    }
    case "abandon":
      return (
        <SheetFrame title={main.title} onClose={close}>
          <p>{text.abandonAsk}</p>
          <div class="btns">
            <button class="btn" type="button" onClick={() => game.toIntro()}>
              {dialog(102).buttons[1000]}
            </button>
            <button class="btn primary" type="button" onClick={close}>
              {text.continue}
            </button>
          </div>
        </SheetFrame>
      );
    default:
      return null;
  }
}

function MenuSheet({ game, t, prefs, setPref, onClassic, close }: Props & { close: () => void }) {
  const intro = dialog(102);
  const go = (fn: () => void) => () => {
    close();
    fn();
  };
  return (
    <SheetFrame title={t("m_more")} onClose={close}>
      <div class="menu">
        <button type="button" onClick={go(() => game.open("scores"))}>
          {intro.buttons[1026]}
        </button>
        <button type="button" onClick={go(() => game.open("story"))}>
          {dialog(166).lines[0]}
        </button>
        <button type="button" onClick={go(() => game.open("about"))}>
          {intro.buttons[1025]}
        </button>
        <button type="button" onClick={go(() => game.boss(true))}>
          {button(1089)}
          <small>Esc</small>
        </button>
        <button type="button" onClick={go(() => game.askNewGame())}>
          {intro.buttons[1000]}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.sound}
          onClick={() => {
            setPref("sound", !prefs.sound);
            soundOn = !prefs.sound;
            play("buy.wav");
          }}
        >
          {t("m_sound")}
          <small>{t(prefs.sound ? "m_on" : "m_off")}</small>
        </button>
        <button type="button" onClick={go(onClassic)}>
          {t("m_classic")}
        </button>
      </div>
      <div class="btns">
        <button class="btn" type="button" onClick={close}>
          {t("m_close")}
        </button>
      </div>
    </SheetFrame>
  );
}

/** 发财之日积月累: the original's tip of the day, before you enter Beijing. */
function TipSheet({ prefs, setPref, close }: Props & { close: () => void }) {
  const d = dialog(113);
  const [k, setK] = useState(() => Math.floor(Math.random() * extras.tips.length));
  const tip = extras.tips[k % extras.tips.length] ?? [];
  const done = () => {
    close();
    document.querySelector<HTMLInputElement>(".bfm #bfm-name")?.focus();
  };
  return (
    <SheetFrame title={d.title} icon={<Line name="bulb" />} onClose={done}>
      <blockquote class="tip">
        <p>{tip[0]}</p>
        <footer>{[tip[2], tip[1]].filter(Boolean).join("，")}</footer>
      </blockquote>
      <label class="check">
        <input type="checkbox" checked={prefs.tips} onChange={(e) => setPref("tips", e.currentTarget.checked)} />
        {d.buttons[2001]}
      </label>
      <div class="btns">
        <button class="btn" type="button" onClick={() => setK(k + 1)}>
          {d.buttons[2002]}
        </button>
        <button class="btn primary" type="button" onClick={done}>
          {d.buttons[1]}
        </button>
      </div>
    </SheetFrame>
  );
}

// ---- before the first day, and after the last -------------------------------------------

function Intro({ game }: Props) {
  const d = dialog(102);
  const lines = d.lines;
  const nameLabel = lines[lines.length - 1] ?? "";
  const groups: { head: string; text: string[] }[] = [];
  for (const l of lines.slice(0, -1)) {
    if (/^(故|要)/.test(l)) groups.push({ head: l, text: [] });
    else groups[groups.length - 1]?.text.push(l);
  }
  return (
    <div class="front">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const field = event.currentTarget.elements.namedItem("name");
          ui.yesterday = null;
          ui.done = null;
          game.start(field instanceof HTMLInputElement ? field.value : "");
        }}
      >
        <div class="masthead">
          <Icon name="city" size={48} />
          <div>
            <h1>{d.title}</h1>
            <p>V 1.2.2 · 郭祥昊 · 2001</p>
          </div>
        </div>
        {groups.map((g, i) => (
          <div key={g.head}>
            <h3>{g.head}</h3>
            {i === 0 ? <p>{g.text.join("")}</p> : g.text.map((l) => <p key={l}>{l}</p>)}
          </div>
        ))}
        <label class="field">
          <span>{nameLabel}</span>
          <input id="bfm-name" name="name" maxLength={12} autoComplete="off" />
        </label>
        <div class="btns">
          <button class="btn primary" type="submit">
            {d.buttons[1000]}
          </button>
          <button class="btn" type="button" onClick={() => game.open("scores")}>
            {d.buttons[1026]}
          </button>
          <button class="btn" type="button" onClick={() => game.open("about")}>
            {d.buttons[1025]}
          </button>
          <button class="btn" type="button" onClick={() => game.open("airport")}>
            {d.buttons[2]}
          </button>
        </div>
      </form>
    </div>
  );
}

function EndingView({ game, t }: Props) {
  const v = game.view;
  const d = game.desk;
  const intro = dialog(102);
  return (
    <div class="front">
      <div>
        <div class="masthead">
          <Icon name="city" size={48} />
          <div>
            <h1>{d.name || text.anonymous}</h1>
            <p>{t("m_closing")}</p>
          </div>
        </div>
        <table class="closing">
          <tbody>
            <tr>
              <td>{label("现")}</td>
              <td>{fmt(v.cash)}</td>
            </tr>
            <tr>
              <td>{label("存款")}</td>
              <td>{fmt(v.deposit)}</td>
            </tr>
            <tr>
              <td>{label("欠")}</td>
              <td>−{fmt(v.debt)}</td>
            </tr>
            <tr class="total">
              <td>{t("m_total")}</td>
              <td>{fmt(v.net)}</td>
            </tr>
          </tbody>
        </table>
        <Lines lines={endingLines(v, d.name)} />
        <p>{text.again}</p>
        <ScoreTable game={game} t={t} />
        <div class="btns">
          <button
            class="btn primary"
            type="button"
            onClick={() => {
              ui.yesterday = null;
              ui.done = null;
              game.start(d.name);
            }}
          >
            {intro.buttons[1000]}
          </button>
          <button class="btn" type="button" onClick={() => game.toIntro()}>
            {(intro.lines[0] ?? "").replace(/\s+/g, "")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Keys for the wide layout: ↑↓ pick a good, → buys, ← sells, B and S too. */
export function modernKeys(game: Game, t: Translate, event: KeyboardEvent): boolean {
  const d = game.desk;
  const wide = (document.querySelector(".bfm")?.clientWidth ?? 0) >= 900;
  const key = event.key;
  if (key === "ArrowDown" || key === "ArrowUp") {
    game.select(d.selected < 0 ? 0 : (d.selected + (key === "ArrowDown" ? 1 : ITEM_COUNT - 1)) % ITEM_COUNT);
  } else if ((key === "ArrowRight" && wide) || key.toLowerCase() === "b") trade(game, t, "buy");
  else if ((key === "ArrowLeft" && wide) || key.toLowerCase() === "s") trade(game, t, "sell");
  else if (key.toLowerCase() === "g") game.toggleGround();
  else return false;
  return true;
}
