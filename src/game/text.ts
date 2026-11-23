// Every word of the game, read from data/ (exported from Beijing.exe) and put
// together the way the original put it together. Nothing here is rewritten:
// the typos, the half-width punctuation and the spaces are the author's.

import dialogData from "../../data/dialogs.json";
import rules from "../../data/rules.json";
import text from "../../data/text.exe.json";
import { Ending, Ev, type GameEvent, Refusal, type View } from "../kernel/kernel.ts";

export { rules, text };

/** The original's printf: %d, %ld, %Ld, %03d, %s and %%. */
export function sprintf(format: string, ...values: Array<string | number>): string {
  let next = 0;
  return format.replace(/%(%|0?(\d*)[lL]?d|s)/g, (_match, spec: string, width: string) => {
    if (spec === "%") return "%";
    const value = String(values[next++] ?? "");
    return width ? value.padStart(Number(width), "0") : value;
  });
}

export const ITEM_COUNT = 8;

export function goodsName(item: number): string {
  return rules.items[item]?.name ?? "";
}

/** Fame the item costs when it is sold (0 for most). */
export function fameCost(item: number): number {
  const entry: { fameOnSell?: number } | undefined = rules.items[item];
  return -(entry?.fameOnSell ?? 0);
}

/** `place` is 1..=10, the original's numbering. */
export function placeName(place: number, ground: boolean): string {
  const names = ground ? rules.groundStations : rules.stations;
  return names[place - 1] ?? "";
}

export function fameName(fame: number): string {
  for (const tier of rules.fameTiers) if (tier.below === null || fame < tier.below) return tier.name;
  return "";
}

export function windowTitle(daysLeft: number): string {
  return sprintf(text.title, 40 - daysLeft);
}

export interface DialogText {
  readonly title: string;
  /** Static lines, top to bottom. */
  readonly lines: readonly string[];
  /** Button captions by control id. */
  readonly buttons: Readonly<Record<number, string>>;
}

/** The text of one of the original's 24 dialog templates. */
export function dialog(id: number): DialogText {
  const entry = (dialogData.dialogs as Record<string, (typeof dialogData.dialogs)["100"]>)[String(id)];
  if (!entry) return { title: "", lines: [], buttons: {} };
  const sorted = [...entry.items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = sorted
    .filter((item) => item.cls === "static" && item.text && item.text !== "Static")
    .map((item) => item.text ?? "");
  const buttons: Record<number, string> = {};
  for (const item of entry.items) if (item.cls === "button" && item.text) buttons[item.id] = item.text;
  return { title: entry.title, lines, buttons };
}

/** 北京新闻 speaks in other people's voices; 我在北京的岁月 is 俺. */
export type PageKind = "news" | "diary";

export interface Page {
  readonly kind: PageKind;
  readonly lines: readonly string[];
}

const diary = (...lines: string[]): Page => ({ kind: "diary", lines });

/** What the original said about each thing a command reported, in its order. */
export function pagesFor(events: readonly GameEvent[], view: View): Page[] {
  const pages: Page[] = [];
  for (const event of events) {
    switch (event.kind) {
      case Ev.market:
        pages.push({ kind: "news", lines: [rules.market[event.a]?.text ?? ""] });
        break;
      case Ev.noRoom:
        pages.push(diary(sprintf(text.houseSmall, event.a)));
        break;
      case Ev.hurt:
        pages.push(diary((rules.health[event.a]?.text ?? "") + sprintf(text.healthLost, event.b)));
        break;
      case Ev.coma: {
        // The original names the place with its own table (in DoRandomEvent), which
        // differs from the map's captions on the ground map.
        const names = view.ground ? rules.groundComaNames : rules.stations;
        const where = names[view.location - 1] ?? "";
        pages.push(
          diary(
            text.comaHead + where + text.comaNear + (rules.comaPlaces[event.a] ?? "") + text.period,
            sprintf(text.comaDays, event.b),
            sprintf(text.comaFee, event.c),
          ),
        );
        break;
      }
      case Ev.crisis:
        pages.push(diary(text.crisis));
        break;
      case Ev.death:
        pages.push(diary(text.death));
        break;
      case Ev.robbed: {
        const what = rules.money[event.a]?.text ?? "";
        pages.push(
          diary(
            event.c === 1
              ? what + sprintf(text.depositLost, event.b) + text.depositLostTail
              : what + sprintf(text.cashLost, event.b),
          ),
        );
        break;
      }
      case Ev.hacker:
        pages.push(diary(sprintf(event.a >= 0 ? text.hackerGain : text.hackerLoss, Math.abs(event.a))));
        break;
      case Ev.cashZero:
        pages.push(diary(text.cashZero));
        break;
      case Ev.beaten:
        pages.push(diary(text.beaten));
        break;
      case Ev.lastDay:
        pages.push(diary(text.lastDay));
        break;
      case Ev.timeUp:
        pages.push(diary(text.timeUp));
        break;
      case Ev.autoSold: {
        // The original appends the names one after another, with nothing between.
        let names = "";
        for (let item = 0; item < ITEM_COUNT; item += 1) if (event.a & (1 << item)) names += goodsName(item);
        pages.push(diary(text.autoSold + names + text.period));
        break;
      }
      case Ev.fame:
        if (event.c === 1) {
          const line = event.a === 4 ? text.fameBook : text.fameLiquor;
          pages.push(diary(text.fameHead + goodsName(event.a) + text.fameSep + line));
        }
        break;
      case Ev.village:
        pages.push(diary(text.villageTiers[event.a] ?? ""));
        break;
      case Ev.rented:
        pages.push(diary(sprintf(text.rentDone, event.a)));
        break;
      case Ev.rentDeclined:
        pages.push(diary(text.rentDecline));
        break;
      case Ev.netGain:
        pages.push(diary(sprintf(text.netGain, event.a)));
        break;
      default:
        break;
    }
  }
  return pages;
}

/** What the original said when it would not do something. */
export function refusalText(code: number, view: View, item: number): string | null {
  switch (code) {
    case Refusal.broke:
      return text.buyNoDeposit;
    case Refusal.goBank:
      return text.buyGoBank;
    case Refusal.roomFull:
      return sprintf(text.houseSmallAsk, view.capacity);
    case Refusal.notHeld:
    case Refusal.noTrade:
      return text.noTradeHead + goodsName(item) + text.noTradeTail;
    case Refusal.healthy:
      return text.hospitalHealthy;
    case Refusal.hospitalPoor:
      return text.hospitalPoor;
    case Refusal.cantPay:
      return text.villageCantPay;
    case Refusal.rentMax:
      return text.rentMax;
    case Refusal.rentPoor:
      return text.rentNoCash;
    case Refusal.netPoor:
      return text.netNoCash;
    case Refusal.netTooMany:
      return text.netTooMany;
    default:
      return null;
  }
}

export interface Score {
  readonly name: string;
  readonly score: number;
  readonly health: number;
  readonly fame: string;
}

export function defaultScores(): Score[] {
  return rules.scoreSeeds.map((seed) => ({ ...seed }));
}

/** The lines of the last page, as the original worded each ending. */
export function endingLines(view: View, name: string): string[] {
  const who = name || text.anonymous;
  switch (view.ending) {
    case Ending.deported:
      return [text.deportedHead + who + text.deportedTail];
    case Ending.dead:
      return [text.death];
    case Ending.unranked:
      return [sprintf(text.scoreLow, view.net)];
    case Ending.ranked: {
      const lines = [
        dialog(164).lines[0] ?? "",
        sprintf(text.rankIn, view.net, view.rank),
        text.titleHead + (rules.titles[view.title] ?? "") + text.titleTail,
        dialog(164).lines[1] ?? "",
      ];
      if (view.net > 10_000_000) lines.push(sprintf(text.scoreHigh, view.net));
      return lines;
    }
    default:
      return [];
  }
}
