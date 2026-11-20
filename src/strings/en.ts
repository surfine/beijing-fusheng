// What the app itself adds around the original text: short labels and notes
// that the 2001 program did not have. The game's own words are not here and
// are not translated: they are the work, and stay as the author wrote them
// (see src/game/text.ts).
export const en = {
  app_title: "Beijing Fusheng",
  held: "held {count}",
  cannot_afford: "can't afford",
  up: "up",
  down: "down",
  room_full: "room full",
  out_of_stock: "——",
  now_each: "now {price}, {delta} each",
  no_buyers: "no buyers here",
  fame_cost: "selling costs {count} fame",
  most: "most",
  total: "total {amount}",
  pick_goods: "Pick goods in either list",
  market_caption: "Black market prices at this place today",
  room_caption: "Goods in your rented room",
  day_of: "Day {day} of 40",
  more_than_yesterday: "{amount} more than yesterday",
  page_of: "{index}/{count}",
  goods: "Goods",
  quantity: "Quantity",
  amount: "Amount",
  standalone: "Saved in this browser",
  loading: "Loading…",
  kernel_failed: "The game could not start: this browser did not load its WebAssembly module.",
  place: "Place",
  name: "Name",
  money: "Money",
  net_worth: "Net worth",
  here: "you are here",
  seed: "seed {seed}",
} as const;

export type StringKey = keyof typeof en;
