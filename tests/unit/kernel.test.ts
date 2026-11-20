import { describe, expect, it } from "vitest";
import rules from "../../data/rules.json";
import { Ending, Kernel, Refusal, Status, Venue } from "../../src/kernel/kernel.ts";

const seeds = rules.scoreSeeds.map((entry) => entry.score);
const same = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, index) => byte === b[index]);

/** Sells what is dear, buys what is cheap, goes round the ten places. */
async function play(seed: number, trade: boolean): Promise<Kernel> {
  const kernel = await Kernel.load();
  kernel.newGame(seed, false, seeds);
  let place = 1;
  while (kernel.view().status === Status.playing) {
    if (trade) {
      const view = kernel.view();
      view.goods.forEach((goods, item) => {
        const range = rules.items[item];
        if (!range) return;
        if (goods.quantity > 0 && goods.price > range.base + range.span / 2) kernel.sell(item, goods.quantity);
      });
      // The same player as kernel/tests/kernel.rs, so both must end on the same number.
      const now = kernel.view();
      if (now.debt > 0 && now.cash > now.debt + 3000) kernel.visit(Venue.post, now.debt);
      for (const item of [1, 4, 3, 6, 5, 0, 7, 2]) {
        const range = rules.items[item];
        const price = kernel.view().goods[item]?.price ?? 0;
        if (!range || price === 0 || price >= range.base + range.span / 3) continue;
        const most = kernel.maxBuy(item);
        if (most > 0) kernel.buy(item, most);
      }
    }
    expect(kernel.move(place).code).toBe(Refusal.ok);
    place = (place % 10) + 1;
  }
  return kernel;
}

describe("the wasm kernel", () => {
  it("starts with 2000 in hand and 5500 owed", async () => {
    const kernel = await Kernel.load();
    kernel.newGame(20010103, false, seeds);
    const view = kernel.view();
    expect([view.cash, view.debt, view.deposit, view.health, view.daysLeft, view.capacity]).toEqual([
      2000, 5500, 0, 100, 40, 100,
    ]);
    expect(view.scores).toEqual(seeds);
  });

  it("gives the same bytes for the same seed and the same commands", async () => {
    for (const seed of [1, 42, 20010103]) {
      const first = (await play(seed, true)).snapshot();
      const second = (await play(seed, true)).snapshot();
      expect(first.length).toBe(512);
      expect(same(first, second)).toBe(true);
      const other = (await play(seed + 1, true)).snapshot();
      expect(same(first, other)).toBe(false);
    }
  });

  it("reaches the list, the train home and the street under fixed seeds", async () => {
    const ranked = (await play(1, true)).view();
    expect([ranked.ending, ranked.net, ranked.rank]).toEqual([Ending.ranked, 1688902, 2]);
    const deported = (await play(8, false)).view();
    expect([deported.ending, deported.net]).toEqual([Ending.deported, -176102]);
    const dead = (await play(1, false)).view();
    expect(dead.ending).toBe(Ending.dead);
    expect(dead.health).toBeLessThan(0);
  });

  it("restores a snapshot and refuses anything else", async () => {
    const kernel = await Kernel.load();
    kernel.newGame(7, false, seeds);
    kernel.move(3);
    const saved = kernel.snapshot();
    const copy = await Kernel.load();
    expect(copy.restore(saved)).toBe(true);
    expect(copy.view()).toEqual(kernel.view());
    expect(copy.move(4).events).toEqual(kernel.move(4).events);
    const broken = saved.slice();
    broken[0] = (broken[0] ?? 0) ^ 1;
    expect(copy.restore(broken)).toBe(false);
    expect(copy.restore(saved.slice(1))).toBe(false);
  });

  it("refuses what the original refused and changes nothing", async () => {
    const kernel = await Kernel.load();
    kernel.newGame(3, false, seeds);
    const before = kernel.snapshot();
    expect(kernel.visit(Venue.hospital, 1).code).toBe(Refusal.healthy);
    expect(kernel.visit(Venue.rent, 1).code).toBe(Refusal.rentPoor);
    expect(kernel.sell(0, 1).code).toBe(Refusal.notHeld);
    expect(kernel.buy(1, 1).code).toBeGreaterThan(0); // 走私汽车: 2000 元 buys none
    expect(same(kernel.snapshot(), before)).toBe(true);
  });
});
