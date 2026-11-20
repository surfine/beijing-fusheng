// The one door to the rules. The kernel is a wasm module with no imports: it
// cannot reach the page, the clock or the network. This file turns its 64
// integers and its event records into values the interface can draw.

import { KERNEL_WASM_BASE64 } from "./kernel.wasm.ts";

export const SNAPSHOT_BYTES = 512;
const SLOTS = 64;

/** State slots, as in kernel/src/lib.rs. */
const Slot = {
  status: 2,
  ending: 3,
  days: 4,
  cash: 5,
  debt: 6,
  deposit: 7,
  health: 8,
  fame: 9,
  capacity: 10,
  used: 11,
  location: 12,
  ground: 13,
  netVisits: 14,
  hacker: 15,
  net: 18,
  rank: 19,
  title: 20,
  seed: 21,
  price: 24,
  quantity: 32,
  cost: 40,
  score: 48,
} as const;

export const Status = { none: 0, playing: 1, over: 2 } as const;
export const Ending = { none: 0, deported: 1, ranked: 2, unranked: 3, dead: 4, abandoned: 5 } as const;
export const Venue = { deposit: 1, withdraw: 2, hospital: 3, post: 4, rent: 5, net: 6 } as const;
export const Option = { hacker: 1, ground: 2 } as const;

/** Event kinds, as in kernel/src/lib.rs. */
export const Ev = {
  prices: 1,
  interest: 2,
  market: 3,
  noRoom: 4,
  hurt: 5,
  coma: 6,
  crisis: 7,
  death: 8,
  robbed: 9,
  hacker: 10,
  cashZero: 11,
  beaten: 12,
  lastDay: 13,
  timeUp: 14,
  autoSold: 15,
  ending: 16,
  fame: 17,
  village: 18,
  rented: 19,
  rentDeclined: 20,
  netGain: 21,
  day: 22,
} as const;

/** Why a command was refused, as in kernel/src/lib.rs. */
export const Refusal = {
  ok: 0,
  notPlaying: 1,
  argument: 2,
  samePlace: 3,
  snapshot: 4,
  noGoods: 10,
  broke: 11,
  goBank: 12,
  roomFull: 13,
  quantity: 14,
  notHeld: 20,
  noTrade: 21,
  bank: 30,
  healthy: 40,
  hospitalPoor: 41,
  cantPay: 51,
  rentMax: 60,
  rentPoor: 61,
  netPoor: 70,
  netTooMany: 71,
} as const;

export interface GameEvent {
  readonly kind: number;
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

export interface Outcome {
  /** 0 when the command was carried out; otherwise a Refusal. */
  readonly code: number;
  readonly events: readonly GameEvent[];
}

export interface Goods {
  readonly price: number;
  readonly quantity: number;
  readonly cost: number;
}

/** Everything the interface draws, read fresh from the kernel each time. */
export interface View {
  readonly status: number;
  readonly ending: number;
  readonly daysLeft: number;
  readonly cash: number;
  readonly debt: number;
  readonly deposit: number;
  readonly health: number;
  readonly fame: number;
  readonly capacity: number;
  readonly used: number;
  readonly location: number;
  readonly ground: boolean;
  readonly hacker: boolean;
  readonly netVisits: number;
  readonly net: number;
  readonly rank: number;
  readonly title: number;
  readonly seed: number;
  readonly goods: readonly Goods[];
  readonly scores: readonly number[];
}

interface Exports {
  readonly memory: WebAssembly.Memory;
  bf_buffer(): number;
  bf_state(): number;
  bf_events(): number;
  bf_event_count(): number;
  bf_set_scores(): void;
  bf_new_game(seed: number, hacker: number): void;
  bf_snapshot(): number;
  bf_restore(length: number): number;
  bf_move(place: number): number;
  bf_max_buy(item: number): number;
  bf_buy(item: number, quantity: number): number;
  bf_sell(item: number, quantity: number): number;
  bf_rent_quote(): bigint;
  bf_visit(venue: number, argument: bigint): number;
  bf_set_option(option: number, value: number): number;
  bf_end(): number;
}

function decode(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export class Kernel {
  private constructor(private readonly wasm: Exports) {}

  static async load(): Promise<Kernel> {
    const { instance } = await WebAssembly.instantiate(decode(KERNEL_WASM_BASE64), {});
    return new Kernel(instance.exports as unknown as Exports);
  }

  private slots(): BigInt64Array {
    return new BigInt64Array(this.wasm.memory.buffer, this.wasm.bf_state(), SLOTS);
  }

  private outcome(code: number): Outcome {
    const count = this.wasm.bf_event_count();
    const raw = new BigInt64Array(this.wasm.memory.buffer, this.wasm.bf_events(), count * 4);
    const events: GameEvent[] = [];
    for (let index = 0; index < count; index += 1) {
      events.push({
        kind: Number(raw[index * 4]),
        a: Number(raw[index * 4 + 1]),
        b: Number(raw[index * 4 + 2]),
        c: Number(raw[index * 4 + 3]),
      });
    }
    return { code, events };
  }

  /** `scores`: the local top ten, highest first; the ending is ranked against it. */
  newGame(seed: number, hacker: boolean, scores: readonly number[]): Outcome {
    this.setScores(scores);
    this.wasm.bf_new_game(seed >>> 0, hacker ? 1 : 0);
    return this.outcome(0);
  }

  setScores(scores: readonly number[]): void {
    const view = new DataView(this.wasm.memory.buffer, this.wasm.bf_buffer(), 80);
    for (let place = 0; place < 10; place += 1) view.setBigInt64(place * 8, BigInt(scores[place] ?? 0), true);
    this.wasm.bf_set_scores();
  }

  snapshot(): Uint8Array {
    const length = this.wasm.bf_snapshot();
    return new Uint8Array(this.wasm.memory.buffer, this.wasm.bf_buffer(), length).slice();
  }

  /** False when the bytes are not a snapshot this kernel wrote; the game in play is then untouched. */
  restore(bytes: Uint8Array): boolean {
    if (bytes.length !== SNAPSHOT_BYTES) return false;
    new Uint8Array(this.wasm.memory.buffer, this.wasm.bf_buffer(), SNAPSHOT_BYTES).set(bytes);
    return this.wasm.bf_restore(bytes.length) === 0;
  }

  move(place: number): Outcome {
    return this.outcome(this.wasm.bf_move(place));
  }

  /** How many can be bought now; a negative number is minus the Refusal. */
  maxBuy(item: number): number {
    return this.wasm.bf_max_buy(item);
  }

  buy(item: number, quantity: number): Outcome {
    return this.outcome(this.wasm.bf_buy(item, quantity));
  }

  sell(item: number, quantity: number): Outcome {
    return this.outcome(this.wasm.bf_sell(item, quantity));
  }

  rentQuote(): number {
    return Number(this.wasm.bf_rent_quote());
  }

  visit(venue: number, argument = 0): Outcome {
    return this.outcome(this.wasm.bf_visit(venue, BigInt(Math.trunc(argument))));
  }

  setOption(option: number, on: boolean): void {
    this.wasm.bf_set_option(option, on ? 1 : 0);
  }

  end(): Outcome {
    return this.outcome(this.wasm.bf_end());
  }

  view(): View {
    const s = this.slots();
    const at = (slot: number) => Number(s[slot] ?? 0n);
    const goods: Goods[] = [];
    for (let item = 0; item < 8; item += 1) {
      goods.push({ price: at(Slot.price + item), quantity: at(Slot.quantity + item), cost: at(Slot.cost + item) });
    }
    const scores: number[] = [];
    for (let place = 0; place < 10; place += 1) scores.push(at(Slot.score + place));
    return {
      status: at(Slot.status),
      ending: at(Slot.ending),
      daysLeft: at(Slot.days),
      cash: at(Slot.cash),
      debt: at(Slot.debt),
      deposit: at(Slot.deposit),
      health: at(Slot.health),
      fame: at(Slot.fame),
      capacity: at(Slot.capacity),
      used: at(Slot.used),
      location: at(Slot.location),
      ground: at(Slot.ground) === 1,
      hacker: at(Slot.hacker) === 1,
      netVisits: at(Slot.netVisits),
      net: at(Slot.net),
      rank: at(Slot.rank),
      title: at(Slot.title),
      seed: at(Slot.seed),
      goods,
      scores,
    };
  }
}
