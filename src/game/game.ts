// The game as the interface holds it: the kernel (the only writable state of
// the rules), plus what is on the desk in front of the player: which goods
// are picked, which slip is open, which pages are waiting to be read.

import { Ending, Ev, type Kernel, Option, type Outcome, Refusal, Status, Venue, type View } from "../kernel/kernel.ts";
import {
  defaultScores,
  fameName,
  ITEM_COUNT,
  type Page,
  pagesFor,
  refusalText,
  rules,
  type Score,
  sprintf,
  text,
} from "./text.ts";

export type Sheet =
  | "bank"
  | "hospital"
  | "post"
  | "rent"
  | "net"
  | "airport"
  | "scores"
  | "about"
  | "statement"
  | "story"
  | "beijing"
  | "abandon"
  | null;

/** What happened to a price today: a market event multiplied or divided it. */
export type Mark = "up" | "down" | null;

export interface Desk {
  readonly phase: "intro" | "play" | "over";
  readonly name: string;
  readonly selected: number;
  /** The quantity box; empty means "as many as possible". */
  readonly quantity: string;
  readonly marks: readonly Mark[];
  /** What the debt grew by on the last day that passed. */
  readonly debtDelta: number;
  readonly pages: readonly Page[];
  readonly sheet: Sheet;
  readonly boss: boolean;
  readonly spellChecked: boolean;
  /** A line the original said in a message box about the last trade. */
  readonly notice: string | null;
  readonly hacker: boolean;
  readonly scores: readonly Score[];
}

export interface Saved {
  readonly v: 1;
  readonly name: string;
  readonly kernel: string;
  readonly marks: readonly Mark[];
  readonly debtDelta: number;
  readonly hacker: boolean;
}

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string): Uint8Array => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export interface Host {
  /** Called after every change: redraw, save, tell the desk. */
  changed(): void;
  seed(): number;
}

export class Game {
  desk: Desk;

  constructor(
    private readonly kernel: Kernel,
    private readonly host: Host,
    scores: readonly Score[] | null,
  ) {
    this.desk = {
      phase: "intro",
      name: "",
      selected: -1,
      quantity: "",
      marks: Array<Mark>(ITEM_COUNT).fill(null),
      debtDelta: 0,
      pages: [],
      sheet: null,
      boss: false,
      spellChecked: false,
      notice: null,
      hacker: false,
      scores: scores && scores.length === 10 ? scores : defaultScores(),
    };
  }

  get view(): View {
    return this.kernel.view();
  }

  private set(patch: Partial<Desk>): void {
    this.desk = { ...this.desk, ...patch };
    this.host.changed();
  }

  /** While a page is up, or the boss is looking, the game takes no input. */
  get blocked(): boolean {
    return this.desk.boss || this.desk.pages.length > 0;
  }

  // -- saving ---------------------------------------------------------------

  save(): Saved | null {
    if (this.desk.phase === "intro") return null;
    return {
      v: 1,
      name: this.desk.name,
      kernel: toBase64(this.kernel.snapshot()),
      marks: this.desk.marks,
      debtDelta: this.desk.debtDelta,
      hacker: this.desk.hacker,
    };
  }

  /** Puts a saved game back. False when it is not one of ours; nothing changes then. */
  load(saved: unknown): boolean {
    if (!saved || typeof saved !== "object") return false;
    const data = saved as Partial<Saved>;
    if (data.v !== 1 || typeof data.kernel !== "string") return false;
    let bytes: Uint8Array;
    try {
      bytes = fromBase64(data.kernel);
    } catch {
      return false;
    }
    if (!this.kernel.restore(bytes)) return false;
    const view = this.view;
    if (view.status === Status.none) return false;
    const marks = Array.isArray(data.marks) && data.marks.length === ITEM_COUNT ? data.marks : this.desk.marks;
    this.set({
      phase: view.status === Status.playing ? "play" : "over",
      name: typeof data.name === "string" ? data.name : "",
      marks,
      debtDelta: typeof data.debtDelta === "number" ? data.debtDelta : 0,
      hacker: view.hacker,
      selected: -1,
      quantity: "",
      pages: [],
      sheet: null,
      notice: null,
    });
    return true;
  }

  // -- the forty days ---------------------------------------------------------

  start(name: string): void {
    const outcome = this.kernel.newGame(
      this.host.seed(),
      this.desk.hacker,
      this.desk.scores.map((entry) => entry.score),
    );
    const interest = outcome.events.find((event) => event.kind === Ev.interest);
    this.set({
      phase: "play",
      name: name.trim(),
      selected: -1,
      quantity: "",
      marks: Array<Mark>(ITEM_COUNT).fill(null),
      debtDelta: interest?.a ?? 0,
      pages: [],
      sheet: null,
      notice: null,
    });
  }

  /** Back to the story page. The game in play, if any, is given up. */
  toIntro(): void {
    if (this.view.status === Status.playing) this.kernel.end();
    this.set({ phase: "intro", pages: [], sheet: null, notice: null, selected: -1 });
  }

  go(place: number): void {
    if (this.blocked || this.desk.phase !== "play") return;
    const outcome = this.kernel.move(place);
    if (outcome.code !== Refusal.ok) return;
    const marks = Array<Mark>(ITEM_COUNT).fill(null);
    let debtDelta = 0;
    for (const event of outcome.events) {
      if (event.kind === Ev.interest) debtDelta += event.a;
      if (event.kind === Ev.coma) debtDelta += event.c;
      if (event.kind === Ev.market) {
        const row = rulesMarket(event.a);
        if (row.debt) debtDelta += row.debt;
        if (row.mul > 0) marks[event.b] = "up";
        if (row.div > 0) marks[event.b] = "down";
      }
    }
    const view = this.view;
    this.finish(outcome, { marks, debtDelta, sheet: null, quantity: "", notice: null }, view);
  }

  private finish(outcome: Outcome, patch: Partial<Desk>, view: View): void {
    const pages = pagesFor(outcome.events, view);
    let scores = this.desk.scores;
    let phase = this.desk.phase;
    if (view.status === Status.over) {
      phase = "over";
      if (view.ending === Ending.ranked && outcome.events.some((event) => event.kind === Ev.ending)) {
        const entry: Score = {
          name: this.desk.name || text.anonymous,
          score: view.net,
          health: view.health,
          fame: fameName(view.fame),
        };
        const next = [...scores];
        next.splice(view.rank - 1, 0, entry);
        scores = next.slice(0, 10);
      }
    }
    this.set({ ...patch, pages: [...this.desk.pages, ...pages], scores, phase });
  }

  /** The button under a page: 确 定 or 关上日记本. */
  turnPage(): void {
    if (this.desk.boss) return;
    this.set({ pages: this.desk.pages.slice(1) });
  }

  // -- trading -----------------------------------------------------------------

  select(item: number): void {
    if (this.blocked) return;
    this.set({ selected: item, quantity: "", notice: null, sheet: null });
  }

  setQuantity(value: string): void {
    this.set({ quantity: value.replace(/\D/g, "").slice(0, 6) });
  }

  /** How many the quantity box means for a purchase: its number, or all that can be bought. */
  private wanted(most: number): number {
    const typed = Number.parseInt(this.desk.quantity, 10);
    return Number.isFinite(typed) && typed > 0 ? Math.min(typed, most) : most;
  }

  buy(all = false): void {
    const item = this.desk.selected;
    if (this.blocked || this.desk.phase !== "play") return;
    if (item < 0) {
      this.set({ notice: text.buyNoneSelected });
      return;
    }
    const most = this.kernel.maxBuy(item);
    if (most < 0) {
      this.set({ notice: refusalText(-most, this.view, item) });
      return;
    }
    const outcome = this.kernel.buy(item, all ? most : this.wanted(most));
    this.afterTrade(outcome, item);
  }

  sell(all = false): void {
    const item = this.desk.selected;
    if (this.blocked || this.desk.phase !== "play" || item < 0) return;
    const held = this.view.goods[item]?.quantity ?? 0;
    const outcome = this.kernel.sell(item, all ? held : this.wanted(held));
    this.afterTrade(outcome, item);
  }

  private afterTrade(outcome: Outcome, item: number): void {
    const view = this.view;
    if (outcome.code !== Refusal.ok) {
      this.set({ notice: refusalText(outcome.code, view, item) });
      return;
    }
    this.finish(outcome, { quantity: "", notice: null }, view);
  }

  // -- the five places of business ------------------------------------------------

  open(sheet: Sheet): void {
    if (this.blocked) return;
    this.set({ sheet, notice: null });
  }

  close(): void {
    this.set({ sheet: null, notice: null });
  }

  /** Runs a visit; what the original said about it becomes a diary page. */
  visit(venue: number, argument = 0, keepOpen = false): void {
    if (this.blocked || this.desk.phase !== "play") return;
    const outcome = this.kernel.visit(venue, argument);
    const view = this.view;
    if (outcome.code !== Refusal.ok) {
      const line = refusalText(outcome.code, view, -1);
      this.set({
        sheet: keepOpen ? this.desk.sheet : null,
        pages: line ? [...this.desk.pages, { kind: "diary", lines: [line] }] : this.desk.pages,
      });
      return;
    }
    this.finish(outcome, { sheet: keepOpen ? this.desk.sheet : null }, view);
  }

  /** Opening a place can already be the whole visit, as in the original. */
  enter(sheet: Exclude<Sheet, null>): void {
    if (this.blocked || this.desk.phase !== "play") return;
    const view = this.view;
    let line: string | null = null;
    if (sheet === "hospital" && view.health >= 100) line = text.hospitalHealthy;
    else if (sheet === "rent" && view.capacity >= 140) line = text.rentMax;
    else if (sheet === "rent" && view.cash < 30000) line = text.rentNoCash;
    else if (sheet === "net" && view.netVisits >= 3) line = text.netTooMany;
    else if (sheet === "net" && view.cash < 15) line = text.netNoCash;
    if (line !== null) {
      this.set({ sheet: null, pages: [...this.desk.pages, { kind: "diary", lines: [line] }] });
      return;
    }
    if (sheet === "post" && view.debt === 0) {
      this.visit(Venue.post);
      return;
    }
    this.open(sheet);
  }

  rentQuoteLine(): string {
    const view = this.view;
    return view.cash > 30000
      ? sprintf(text.rentQuote, this.kernel.rentQuote(), view.capacity + 10)
      : sprintf(text.rentFlat, view.capacity + 10);
  }

  // -- the rest -------------------------------------------------------------------

  toggleGround(): void {
    if (this.blocked || this.desk.phase !== "play") return;
    this.kernel.setOption(Option.ground, !this.view.ground);
    this.host.changed();
  }

  toggleHacker(): void {
    const hacker = !this.desk.hacker;
    this.kernel.setOption(Option.hacker, hacker);
    this.set({ hacker });
  }

  /** 老板来了: in one frame, and back in one frame. */
  boss(on: boolean): void {
    this.set({ boss: on, spellChecked: false });
  }

  spellCheck(): void {
    this.set({ spellChecked: true });
  }

  /** How many of the goods can be bought now; negative is minus the Refusal. */
  maxBuy(item: number): number {
    return this.kernel.maxBuy(item);
  }

  /** 新 游 戏 from the menu: the original asks before it throws a game away. */
  askNewGame(): void {
    if (this.desk.boss) return;
    if (this.desk.phase === "play" && 40 - this.view.daysLeft >= 3) this.set({ sheet: "abandon", notice: null });
    else this.toIntro();
  }

  /** The goods a line in the room can be sold for here, per piece, against its cost. */
  profit(item: number): number | null {
    const goods = this.view.goods[item];
    if (!goods || goods.quantity === 0 || goods.price === 0) return null;
    return goods.price - goods.cost;
  }
}

function rulesMarket(row: number): { mul: number; div: number; debt: number } {
  return rules.market[row] ?? { mul: 0, div: 0, debt: 0 };
}
