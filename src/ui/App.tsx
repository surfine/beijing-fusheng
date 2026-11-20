import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { Game, Sheet } from "../game/game.ts";
import {
  dialog,
  endingLines,
  fameCost,
  fameName,
  goodsName,
  ITEM_COUNT,
  placeName,
  rules,
  sprintf,
  text,
  windowTitle,
} from "../game/text.ts";
import { Ending, Refusal, Venue, type View } from "../kernel/kernel.ts";
import type { StringKey } from "../strings/index.ts";
import { Art, Icon, type IconName } from "./Art.tsx";

export type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

interface Props {
  readonly game: Game;
  readonly t: Translate;
  /** Phone width: one merged list instead of two tables. */
  readonly narrow: boolean;
  readonly onSave: () => void;
}

const money = (value: number): string => value.toLocaleString("en-US");
const signed = (value: number): string => (value >= 0 ? `+${money(value)}` : `−${money(-value)}`);

/** The ten places as the original laid its buttons out, on three rows. */
const MAP_WIDE = [3, 7, 5, 10, 9, 6, 1, 8, 4, 2] as const;
/** Along the line, for the phone: the ring clockwise from 西直门, then the west spur. */
const MAP_NARROW = [3, 7, 5, 1, 2, 4, 8, 6, 9, 10] as const;

const main = dialog(129);
/** A caption of the main window by how it begins (static texts first, then group boxes). */
const mainLine = (prefix: string): string =>
  main.lines.find((line) => line.startsWith(prefix)) ??
  Object.values(main.buttons).find((line) => line.startsWith(prefix)) ??
  "";
const VENUES: ReadonlyArray<{ sheet: Exclude<Sheet, null>; id: number; icon?: IconName }> = [
  { sheet: "bank", id: 1084, icon: "card" },
  { sheet: "hospital", id: 1085, icon: "hospital" },
  { sheet: "post", id: 1086, icon: "letter" },
  { sheet: "rent", id: 1087, icon: "house" },
  { sheet: "net", id: 1088 },
];

export function App({ game, t, narrow, onSave }: Props) {
  const { desk, view } = game;
  if (desk.boss) return <Boss game={game} onSave={onSave} />;
  if (desk.phase === "intro") return <Intro game={game} t={t} />;
  const page = desk.pages[0];
  const playing = desk.phase === "play";
  return (
    <div class="bf" data-narrow={narrow ? "" : undefined}>
      <header class="bf-head">
        <Icon name="city" size={32} />
        <h1 class="bf-title">{windowTitle(view.daysLeft)}</h1>
        <Dots left={view.daysLeft} label={t("day_of", { day: 40 - view.daysLeft })} />
        <span class="bf-where">{view.location > 0 ? placeName(view.location, view.ground) : ""}</span>
      </header>
      <section class="bf-desk">
        {page ? (
          <PageView game={game} t={t} />
        ) : desk.sheet ? (
          <SheetView game={game} t={t} />
        ) : playing ? (
          <Trading game={game} t={t} narrow={narrow} />
        ) : (
          <EndingView game={game} t={t} />
        )}
      </section>
      <Ledger view={view} debtDelta={desk.debtDelta} t={t} />
      <PlaceMap game={game} t={t} narrow={narrow} />
      <nav class="bf-venues">
        {VENUES.map((venue) => (
          <button
            key={venue.sheet}
            type="button"
            class="bf-button"
            disabled={!playing || game.blocked}
            aria-pressed={desk.sheet === venue.sheet}
            onClick={() => game.enter(venue.sheet)}
          >
            {venue.icon ? <Icon name={venue.icon} size={16} /> : null}
            {main.buttons[venue.id]}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Forty dots: one is wiped out each day. The original's blue strip of white dots. */
function Dots({ left, label }: { left: number; label: string }) {
  const dots = [];
  for (let day = 0; day < 40; day += 1) {
    dots.push(<i key={day} class={day < 40 - left ? "bf-dot bf-dot-gone" : "bf-dot"} />);
  }
  return (
    <div class="bf-dots" role="img" aria-label={label}>
      {dots}
    </div>
  );
}

// ---- the trading desk ---------------------------------------------------------

function rowKeys(game: Game, event: KeyboardEvent, items: readonly number[], item: number) {
  const index = items.indexOf(item);
  const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
  if (step === 0 || index < 0) return;
  event.preventDefault();
  const next = items[(index + step + items.length) % items.length];
  if (next === undefined) return;
  const body = (event.currentTarget as HTMLElement).parentElement;
  game.select(next);
  body?.querySelector<HTMLElement>(`[data-item="${next}"]`)?.focus();
}

function Trading({ game, t, narrow }: { game: Game; t: Translate; narrow: boolean }) {
  const { desk, view } = game;
  const all = Array.from({ length: ITEM_COUNT }, (_, item) => item);
  const held = all.filter((item) => (view.goods[item]?.quantity ?? 0) > 0);
  const full = view.used >= view.capacity;
  const focusItem = Math.max(desk.selected, 0);

  const notes = (item: number): ComponentChildren => {
    const goods = view.goods[item];
    if (!goods) return null;
    const mark = desk.marks[item];
    return (
      <>
        {goods.quantity > 0 && !narrow ? (
          <span class="bf-tag bf-tag-held">{t("held", { count: goods.quantity })}</span>
        ) : null}
        {mark === "up" && goods.price > 0 ? <span class="bf-tag bf-tag-up">{t("up")}</span> : null}
        {mark === "down" && goods.price > 0 ? <span class="bf-tag bf-tag-down">{t("down")}</span> : null}
        {goods.price > view.cash ? <span class="bf-note">{t("cannot_afford")}</span> : null}
      </>
    );
  };

  const marketRow = (item: number) => {
    const goods = view.goods[item];
    if (!goods) return null;
    const none = goods.price === 0;
    const selected = desk.selected === item;
    const profit = game.profit(item);
    return (
      <>
        <tr
          key={item}
          data-item={item}
          class={`bf-row${none ? " bf-row-none" : ""}${goods.price > view.cash ? " bf-row-poor" : ""}`}
          aria-selected={selected}
          tabIndex={item === focusItem ? 0 : -1}
          onClick={() => game.select(item)}
          onKeyDown={(event) => rowKeys(game, event, all, item)}
        >
          <th scope="row">
            <div class="bf-cell">
              <Icon name="goods" size={16} />
              <span class="bf-name">{goodsName(item)}</span>
              {notes(item)}
            </div>
          </th>
          <td class="bf-num">{none ? t("out_of_stock") : money(goods.price)}</td>
          {narrow ? <td class="bf-num bf-held-count">{goods.quantity > 0 ? goods.quantity : ""}</td> : null}
        </tr>
        {narrow && selected ? (
          <tr key={`trade-${item}`} class="bf-row-trade">
            <td colSpan={3}>
              {goods.quantity > 0 ? (
                <p class="bf-sub">
                  {text.colBuyPrice} {money(goods.cost)} ·{" "}
                  {profit === null
                    ? t("no_buyers")
                    : t("now_each", { price: money(goods.price), delta: signed(profit) })}
                  {fameCost(item) > 0 ? ` · ${t("fame_cost", { count: fameCost(item) })}` : ""}
                </p>
              ) : null}
              <TradeBar game={game} t={t} />
            </td>
          </tr>
        ) : null}
      </>
    );
  };

  const market = (
    <table class="bf-table bf-market">
      <caption>
        <span class="bf-caption">{mainLine("黑")}</span>
        <span class="bf-sr">{t("market_caption")}</span>
        {full ? <span class="bf-tag bf-tag-down">{t("room_full")}</span> : null}
        {narrow ? (
          <span class="bf-caption-side">
            <Icon name="house" size={16} />
            {view.used}/{view.capacity}
          </span>
        ) : null}
      </caption>
      <thead>
        <tr>
          <th scope="col">{t("goods")}</th>
          <th scope="col" class="bf-num">
            {text.colMarketPrice}
          </th>
          {narrow ? (
            <th scope="col" class="bf-num">
              {t("quantity")}
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>{all.map(marketRow)}</tbody>
    </table>
  );
  if (narrow) return <div class="bf-trading">{market}</div>;

  return (
    <div class="bf-trading">
      {market}
      <TradeBar game={game} t={t} />
      <table class="bf-table bf-room">
        <caption>
          <Icon name="house" size={16} />
          <span class="bf-caption">{mainLine("您的出租屋")}</span>
          <span class="bf-sr">{t("room_caption")}</span>
          <span class="bf-caption-side">
            {view.used}/{view.capacity}
          </span>
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("goods")}</th>
            <th scope="col" class="bf-num">
              {text.colBuyPrice}
            </th>
            <th scope="col" class="bf-num">
              {t("quantity")}
            </th>
          </tr>
        </thead>
        <tbody>
          {held.map((item, index) => {
            const goods = view.goods[item];
            if (!goods) return null;
            const profit = game.profit(item);
            const fame = fameCost(item);
            return (
              <tr
                key={item}
                data-item={item}
                class="bf-row bf-row-held"
                aria-selected={desk.selected === item}
                tabIndex={desk.selected === item || (index === 0 && !held.includes(desk.selected)) ? 0 : -1}
                onClick={() => game.select(item)}
                onKeyDown={(event) => rowKeys(game, event, held, item)}
              >
                <th scope="row">
                  <div class="bf-cell bf-cell-two">
                    <span class="bf-name">{goodsName(item)}</span>
                    <span class="bf-sub">
                      {profit === null
                        ? t("no_buyers")
                        : t("now_each", { price: money(goods.price), delta: signed(profit) })}
                      {fame > 0 ? ` · ${t("fame_cost", { count: fame })}` : ""}
                    </span>
                  </div>
                </th>
                <td class="bf-num">{money(goods.cost)}</td>
                <td class="bf-num">{goods.quantity}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Buying and selling: two arrows that point opposite ways, and one number. */
function TradeBar({ game, t }: { game: Game; t: Translate }) {
  const { desk, view } = game;
  const item = desk.selected;
  const goods = item >= 0 ? view.goods[item] : undefined;
  const most = item >= 0 ? game.maxBuy(item) : 0;
  const held = goods?.quantity ?? 0;
  const typed = Number.parseInt(desk.quantity, 10);
  const count = (limit: number) => (Number.isFinite(typed) && typed > 0 ? Math.min(typed, limit) : limit);
  const canSell = !!goods && held > 0 && goods.price > 0;

  let hint: string;
  if (!goods) hint = desk.notice ?? t("pick_goods");
  else if (desk.notice) hint = desk.notice;
  else if (most === -Refusal.roomFull) hint = sprintf(text.buyFull, view.cash);
  else if (most > 0) hint = sprintf(text.buyMax, view.cash, most);
  else if (held > 0) hint = sprintf(text.sellHave, held);
  else hint = "";

  return (
    <div class="bf-trade">
      <div class="bf-trade-goods">{goods ? goodsName(item) : ""}</div>
      <label class="bf-trade-quantity">
        <span class="bf-sr">{t("quantity")}</span>
        <input
          class="bf-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={desk.quantity}
          placeholder={goods ? `${t("most")} ${Math.max(most, held, 0)}` : ""}
          disabled={!goods}
          onInput={(event) => game.setQuantity(event.currentTarget.value)}
        />
      </label>
      <p class="bf-trade-hint" aria-live="polite">
        {hint}
      </p>
      <button type="button" class="bf-button bf-buy" disabled={!goods || most <= 0} onClick={() => game.buy()}>
        <span>{mainLine("买")}</span>
        <span class="bf-arrow">{(main.buttons[1006] ?? "").trim()}</span>
        {goods && most > 0 ? (
          <span class="bf-sum">{t("total", { amount: money(count(most) * goods.price) })}</span>
        ) : null}
      </button>
      <button type="button" class="bf-button bf-sell" disabled={!canSell} onClick={() => game.sell()}>
        <span class="bf-arrow">{(main.buttons[1003] ?? "").trim()}</span>
        <span>{mainLine("卖")}</span>
        {goods && canSell ? (
          <span class="bf-sum">{t("total", { amount: money(count(held) * goods.price) })}</span>
        ) : null}
      </button>
      <button
        type="button"
        class="bf-button bf-all bf-all-buy"
        disabled={!goods || most <= 0}
        onClick={() => game.buy(true)}
      >
        {main.buttons[1004]}
      </button>
      <button type="button" class="bf-button bf-all bf-all-sell" disabled={!canSell} onClick={() => game.sell(true)}>
        {main.buttons[1005]}
      </button>
    </div>
  );
}

// ---- the five numbers ------------------------------------------------------------

function Ledger({ view, debtDelta, t }: { view: View; debtDelta: number; t: Translate }) {
  return (
    <section class="bf-ledger">
      <h2 class="bf-heading">{mainLine("您的状态")}</h2>
      <dl>
        <div>
          <dt>{mainLine("现")}</dt>
          <dd>{money(view.cash)}</dd>
        </div>
        <div>
          <dt>{mainLine("存款")}</dt>
          <dd>{money(view.deposit)}</dd>
        </div>
        <div class={view.debt > 0 ? "bf-owed" : undefined}>
          <dt>{mainLine("欠")}</dt>
          <dd>
            {debtDelta > 0 && view.debt > 0 ? (
              <span class="bf-delta" role="note" aria-label={t("more_than_yesterday", { amount: money(debtDelta) })}>
                {signed(debtDelta)}
              </span>
            ) : null}
            {money(view.debt)}
          </dd>
        </div>
        <div class={view.health < 20 ? "bf-alarm" : undefined}>
          <dt>{mainLine("健康")}</dt>
          <dd>{view.health}</dd>
        </div>
        <div class={view.fame < 60 ? "bf-alarm" : undefined}>
          <dt>{mainLine("名声")}</dt>
          <dd>{fameName(view.fame)}</dd>
        </div>
      </dl>
    </section>
  );
}

// ---- the ten places --------------------------------------------------------------

function PlaceMap({ game, t, narrow }: { game: Game; t: Translate; narrow: boolean }) {
  const { desk, view } = game;
  const playing = desk.phase === "play";
  const station = (place: number) => (
    <button
      key={place}
      type="button"
      class="bf-button bf-station"
      style={narrow ? undefined : { gridArea: `p${place}` }}
      disabled={!playing || game.blocked}
      aria-current={view.location === place ? "location" : undefined}
      aria-label={view.location === place ? `${placeName(place, view.ground)}（${t("here")}）` : undefined}
      onClick={() => game.go(place)}
    >
      {placeName(place, view.ground)}
    </button>
  );
  const toggle = (
    <button
      type="button"
      class="bf-button bf-toggle"
      disabled={!playing || game.blocked}
      onClick={() => game.toggleGround()}
    >
      {view.ground ? text.toSubway : text.toGround}
    </button>
  );
  const boss = (
    <button type="button" class="bf-button bf-boss" onClick={() => game.boss(true)}>
      {main.buttons[1089]}
    </button>
  );
  return (
    <section class="bf-map">
      <h2 class="bf-heading">{view.ground ? text.mapGround : text.mapSubway}</h2>
      {narrow ? (
        <div class="bf-line">
          {MAP_NARROW.map(station)}
          {toggle}
          {boss}
        </div>
      ) : (
        <div class="bf-ring">
          <i class="bf-loop" />
          <i class="bf-spur" />
          {MAP_WIDE.map(station)}
          {toggle}
          {boss}
        </div>
      )}
    </section>
  );
}

// ---- pages: the world interrupts ---------------------------------------------------

/** Moves the focus to the button under a page or a slip when it appears. */
function useFocus<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [key]);
  return ref;
}

function PageView({ game, t }: { game: Game; t: Translate }) {
  const page = game.desk.pages[0];
  const total = game.desk.pages.length;
  const button = useFocus<HTMLButtonElement>(page);
  if (!page) return null;
  const news = page.kind === "news";
  const paper = dialog(news ? 138 : 142);
  return (
    <div
      class={`bf-page bf-page-${page.kind}`}
      role="alertdialog"
      aria-labelledby="bf-page-title"
      aria-describedby="bf-page-text"
    >
      <Art name={news ? "news" : "diary"} />
      <div class="bf-page-body">
        <h2 id="bf-page-title" class="bf-page-title">
          {paper.title}
          {total > 1 ? <span class="bf-page-count">{t("page_of", { index: 1, count: total })}</span> : null}
        </h2>
        <div id="bf-page-text" class="bf-page-text">
          {page.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <button ref={button} type="button" class="bf-button bf-primary" onClick={() => game.turnPage()}>
          {paper.buttons[1]}
        </button>
      </div>
    </div>
  );
}

// ---- slips: bank, hospital, post office, agency, café, and the papers ----------------

function Slip({
  title,
  icon,
  children,
  actions,
}: {
  title: string;
  icon?: IconName | undefined;
  children: ComponentChildren;
  actions: ComponentChildren;
}) {
  return (
    <div class="bf-slip" role="dialog" aria-labelledby="bf-slip-title">
      <h2 id="bf-slip-title" class="bf-slip-title">
        {icon ? <Icon name={icon} size={32} /> : null}
        {title}
      </h2>
      <div class="bf-slip-body">{children}</div>
      <div class="bf-slip-actions">{actions}</div>
    </div>
  );
}

function AmountSlip({
  game,
  t,
  title,
  icon,
  lines,
  label,
  most,
  actions,
}: {
  game: Game;
  t: Translate;
  title: string;
  icon?: IconName;
  lines: readonly string[];
  label: string;
  most: number;
  actions: (amount: number) => ComponentChildren;
}) {
  const input = useFocus<HTMLInputElement>(title);
  const typed = Number.parseInt(game.desk.quantity, 10);
  const amount = Number.isFinite(typed) && typed > 0 ? typed : most;
  return (
    <Slip title={title} icon={icon} actions={actions(amount)}>
      {lines.map((line) => (
        <p key={line} class="bf-prose">
          {line}
        </p>
      ))}
      <label class="bf-field">
        <span>{label}</span>
        <input
          ref={input}
          class="bf-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={label || t("amount")}
          value={game.desk.quantity}
          placeholder={String(most)}
          onInput={(event) => game.setQuantity(event.currentTarget.value)}
        />
      </label>
    </Slip>
  );
}

function ScoreTable({ game, t }: { game: Game; t: Translate }) {
  const { view, desk } = game;
  const mine = view.ending === Ending.ranked && desk.phase === "over" ? view.rank - 1 : -1;
  return (
    <table class="bf-table bf-scores">
      <caption>
        <Icon name="letter" size={16} />
        <span class="bf-caption">{dialog(137).lines[0]}</span>
      </caption>
      <thead>
        <tr>
          <th scope="col">{t("place")}</th>
          <th scope="col">{t("name")}</th>
          <th scope="col" class="bf-num">
            {t("money")}
          </th>
          <th scope="col" class="bf-num">
            {text.healthLabel}
          </th>
          <th scope="col">{mainLine("名声").replace(":", "")}</th>
        </tr>
      </thead>
      <tbody>
        {desk.scores.map((entry, place) => (
          <tr key={place} class="bf-row" aria-selected={place === mine}>
            <th scope="row">{text.ranks[place]}</th>
            <td>{entry.name}</td>
            <td class="bf-num">{money(entry.score)}</td>
            <td class="bf-num">{entry.health}</td>
            <td>{entry.fame}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {lines.map((line) => (
        <p key={line} class="bf-prose">
          {line}
        </p>
      ))}
    </>
  );
}

function SheetView({ game, t }: { game: Game; t: Translate }) {
  const { desk, view } = game;
  const ok = useFocus<HTMLButtonElement>(desk.sheet);
  const close = (label: string | undefined) => (
    <button ref={ok} type="button" class="bf-button bf-primary" onClick={() => game.close()}>
      {label}
    </button>
  );
  switch (desk.sheet) {
    case "bank": {
      const bank = dialog(133);
      return (
        <AmountSlip
          game={game}
          t={t}
          title={bank.title}
          icon="card"
          lines={[sprintf(text.bankAsk, view.cash, view.deposit)]}
          label={t("amount")}
          most={Math.max(view.cash, view.deposit)}
          actions={(amount) => (
            <>
              <button
                type="button"
                class="bf-button bf-primary"
                disabled={view.cash < 1}
                onClick={() => game.visit(Venue.deposit, Math.min(amount, view.cash), true)}
              >
                {bank.buttons[1]}
              </button>
              <button
                type="button"
                class="bf-button"
                disabled={view.deposit < 1}
                onClick={() => game.visit(Venue.withdraw, Math.min(amount, view.deposit), true)}
              >
                {bank.buttons[2]}
              </button>
              <button type="button" class="bf-button" onClick={() => game.close()}>
                {bank.buttons[1111]}
              </button>
            </>
          )}
        />
      );
    }
    case "hospital": {
      const hospital = dialog(135);
      const need = 100 - view.health;
      return (
        <AmountSlip
          game={game}
          t={t}
          title={hospital.title}
          icon="hospital"
          lines={[sprintf(text.hospitalAsk, view.health, need) + (hospital.lines[0] ?? "")]}
          label={hospital.lines[1] ?? ""}
          most={Math.max(1, Math.min(need, Math.floor(view.cash / rules.hospital.pricePerPoint)))}
          actions={(amount) => (
            <>
              <button
                type="button"
                class="bf-button bf-primary"
                onClick={() => game.visit(Venue.hospital, Math.min(amount, need))}
              >
                {hospital.buttons[1]}
              </button>
              <button type="button" class="bf-button" onClick={() => game.close()}>
                {hospital.buttons[2]}
              </button>
            </>
          )}
        />
      );
    }
    case "post": {
      const post = dialog(136);
      return (
        <AmountSlip
          game={game}
          t={t}
          title={post.title}
          lines={[sprintf(text.villageOwe, view.debt)]}
          label={post.lines[0] ?? ""}
          most={Math.max(1, Math.min(view.cash, view.debt))}
          actions={(amount) => (
            <>
              <button
                type="button"
                class="bf-button bf-primary"
                onClick={() => game.visit(Venue.post, Math.min(amount, view.debt))}
              >
                {post.buttons[1]}
              </button>
              <button type="button" class="bf-button" onClick={() => game.close()}>
                {post.buttons[2]}
              </button>
            </>
          )}
        />
      );
    }
    case "rent": {
      const rent = dialog(163);
      return (
        <Slip
          title={rent.title}
          icon="house"
          actions={
            <>
              <button ref={ok} type="button" class="bf-button bf-primary" onClick={() => game.visit(Venue.rent, 1)}>
                {rent.buttons[1]}
              </button>
              <button type="button" class="bf-button" onClick={() => game.visit(Venue.rent, 0)}>
                {rent.buttons[2]}
              </button>
            </>
          }
        >
          <Lines lines={[...rent.lines, sprintf(text.rentSmall, view.capacity), game.rentQuoteLine()]} />
        </Slip>
      );
    }
    case "net": {
      const net = dialog(160);
      return (
        <Slip
          title={net.title}
          actions={
            <button ref={ok} type="button" class="bf-button bf-primary" onClick={() => game.visit(Venue.net)}>
              {net.buttons[1]}
            </button>
          }
        >
          <Lines lines={net.lines} />
        </Slip>
      );
    }
    case "airport": {
      const airport = dialog(145);
      return (
        <Slip title={airport.title} actions={close(airport.buttons[1])}>
          <Lines lines={airport.lines} />
        </Slip>
      );
    }
    case "scores":
      return (
        <Slip title={dialog(137).title} actions={close(dialog(137).buttons[1])}>
          <ScoreTable game={game} t={t} />
        </Slip>
      );
    case "about": {
      const about = dialog(100);
      return (
        <Slip
          title={about.title}
          icon="city"
          actions={
            <>
              {close(about.buttons[1])}
              <button type="button" class="bf-button" onClick={() => game.open("statement")}>
                {about.buttons[1122]}
              </button>
            </>
          }
        >
          <Lines lines={about.lines} />
          <p class="bf-prose">
            {about.buttons[1121]}：{dialog(171).lines[0]}
          </p>
          <p class="bf-prose">{text.authorNote}</p>
        </Slip>
      );
    }
    case "statement": {
      const statement = dialog(172);
      return (
        <Slip title={statement.lines[0] ?? ""} actions={close(statement.buttons[1])}>
          <Lines lines={statement.lines.slice(1)} />
        </Slip>
      );
    }
    case "story": {
      const story = dialog(166);
      return (
        <Slip title={story.lines[0] ?? ""} icon="bulb" actions={close(dialog(167).buttons[1])}>
          <Lines lines={story.lines.slice(1)} />
        </Slip>
      );
    }
    case "beijing": {
      const beijing = dialog(167);
      return (
        <Slip title={beijing.lines[0] ?? ""} icon="city" actions={close(beijing.buttons[1])}>
          <Lines lines={beijing.lines.slice(1)} />
        </Slip>
      );
    }
    case "abandon":
      return (
        <Slip
          title={main.title}
          actions={
            <>
              <button ref={ok} type="button" class="bf-button bf-primary" onClick={() => game.close()}>
                {text.continue}
              </button>
              <button type="button" class="bf-button" onClick={() => game.toIntro()}>
                {dialog(102).buttons[1000]}
              </button>
            </>
          }
        >
          <Lines lines={[text.abandonAsk]} />
        </Slip>
      );
    default:
      return null;
  }
}

// ---- the end: a closed ledger -------------------------------------------------------

function EndingView({ game, t }: { game: Game; t: Translate }) {
  const { view, desk } = game;
  const again = useFocus<HTMLButtonElement>(view.ending);
  const intro = dialog(102);
  return (
    <div class="bf-ending">
      <div class="bf-ending-account">
        <dl class="bf-closing">
          <div>
            <dt>{mainLine("现")}</dt>
            <dd>{money(view.cash)}</dd>
          </div>
          <div>
            <dt>{mainLine("存款")}</dt>
            <dd>{money(view.deposit)}</dd>
          </div>
          <div>
            <dt>{mainLine("欠")}</dt>
            <dd>−{money(view.debt)}</dd>
          </div>
          <div class="bf-closing-net">
            <dt>{t("net_worth")}</dt>
            <dd>{view.net < 0 ? `−${money(-view.net)}` : money(view.net)}</dd>
          </div>
        </dl>
        <Lines lines={endingLines(view, desk.name)} />
        <p class="bf-prose">{text.again}</p>
        <div class="bf-slip-actions">
          <button ref={again} type="button" class="bf-button bf-primary" onClick={() => game.start(desk.name)}>
            {intro.buttons[1000]}
          </button>
          <button type="button" class="bf-button" onClick={() => game.toIntro()}>
            {intro.lines[0]}
          </button>
        </div>
      </div>
      <ScoreTable game={game} t={t} />
    </div>
  );
}

// ---- before the first day ------------------------------------------------------------

function Intro({ game, t }: { game: Game; t: Translate }) {
  const intro = dialog(102);
  const nameLabel = intro.lines[intro.lines.length - 1] ?? "";
  const story = intro.lines.slice(0, -1);
  const input = useFocus<HTMLInputElement>("intro");
  if (game.desk.sheet) {
    return (
      <div class="bf bf-intro">
        <section class="bf-desk bf-desk-full">
          <SheetView game={game} t={t} />
        </section>
      </div>
    );
  }
  return (
    <div class="bf bf-intro">
      <form
        class="bf-story"
        onSubmit={(event) => {
          event.preventDefault();
          const field = event.currentTarget.elements.namedItem("name");
          game.start(field instanceof HTMLInputElement ? field.value : "");
        }}
      >
        <header class="bf-story-head">
          <Icon name="city" size={64} />
          <h1>{intro.title}</h1>
        </header>
        {story.map((line) =>
          /^(故|要)/.test(line) ? (
            <h2 key={line} class="bf-heading">
              {line}
            </h2>
          ) : (
            <p key={line} class="bf-prose">
              {line}
            </p>
          ),
        )}
        <label class="bf-field">
          <span>{nameLabel}</span>
          <input ref={input} class="bf-input bf-input-name" name="name" type="text" maxLength={12} autoComplete="off" />
        </label>
        <div class="bf-slip-actions">
          <button type="submit" class="bf-button bf-primary">
            {intro.buttons[1000]}
          </button>
          <button type="button" class="bf-button" onClick={() => game.open("scores")}>
            {intro.buttons[1026]}
          </button>
          <button type="button" class="bf-button" onClick={() => game.open("about")}>
            {intro.buttons[1025]}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---- 老板来了 ---------------------------------------------------------------------------

/** The memo, as the original showed it: the title line, then eight points. */
export function bossDocument(): string {
  return [
    text.boss.title.replace(/\s+$/, ""),
    "",
    ...text.boss.lines.map((line) => line.replace(/\r\n/g, "").trim()),
  ].join("\n");
}

function Boss({ game, onSave }: { game: Game; onSave: () => void }) {
  const writing = dialog(168);
  const area = useFocus<HTMLTextAreaElement>("boss");
  return (
    <div class="bf-boss-page">
      <textarea ref={area} class="bf-boss-text" spellcheck={false} aria-label={writing.title}>
        {bossDocument()}
      </textarea>
      {game.desk.spellChecked ? <p class="bf-boss-spell">{text.boss.spell}</p> : null}
      <div class="bf-boss-actions">
        <button type="button" onClick={() => game.boss(false)}>
          {writing.buttons[1]}
        </button>
        <button type="button" onClick={onSave}>
          {writing.buttons[1114]}
        </button>
        <button type="button" onClick={() => game.spellCheck()}>
          {writing.buttons[1115]}
        </button>
      </div>
    </div>
  );
}
