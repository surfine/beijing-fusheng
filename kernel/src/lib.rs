//! The rules of 北京浮生记 (Beijing.exe V1.2.2 build 0103, 2001), rewritten
//! from the original. No DOM, no clock, no network: a state of
//! 64 integers, a seeded generator, and commands that say what happened.
//!
//! Every number is in `tables.rs`, generated from `data/rules.json`, which
//! names the address in Beijing.exe each one was read from.

#![cfg_attr(target_arch = "wasm32", no_std)]

pub mod tables;
use tables::*;

// ---- state slots -----------------------------------------------------------

pub const SLOTS: usize = 64;
pub const SNAPSHOT_BYTES: usize = SLOTS * 8;
/// "BJFS" and the layout version.
pub const MAGIC: i64 = 0x424a_4653_0000_0001;

pub const MAGIC_SLOT: usize = 0;
pub const RNG: usize = 1;
pub const STATUS: usize = 2;
pub const ENDING: usize = 3;
pub const DAYS: usize = 4;
pub const CASH: usize = 5;
pub const DEBT: usize = 6;
pub const DEPOSIT: usize = 7;
pub const HEALTH: usize = 8;
pub const FAME: usize = 9;
pub const CAPACITY: usize = 10;
pub const USED: usize = 11;
/// 0 before the first move, then 1..=10 (the original's field 0x760).
pub const LOCATION: usize = 12;
/// 0: the subway map, 1: the ground map (same ten places, other names).
pub const GROUND: usize = 13;
pub const NET_VISITS: usize = 14;
pub const HACKER: usize = 15;
/// bit 0: the 禁书 fame line was shown; bit 1: the 假白酒 one.
pub const FLAGS: usize = 16;
/// Commands that moved the clock, for the interface's own counting.
pub const TURN: usize = 17;
pub const NET: usize = 18;
pub const RANK: usize = 19;
pub const TITLE: usize = 20;
pub const SEED: usize = 21;
pub const PRICE_0: usize = 24;
pub const QTY_0: usize = 32;
pub const COST_0: usize = 40;
pub const SCORE_0: usize = 48;

pub const STATUS_NONE: i64 = 0;
pub const STATUS_PLAYING: i64 = 1;
pub const STATUS_OVER: i64 = 2;

pub const ENDING_NONE: i64 = 0;
pub const ENDING_DEPORTED: i64 = 1;
pub const ENDING_RANKED: i64 = 2;
pub const ENDING_UNRANKED: i64 = 3;
pub const ENDING_DEAD: i64 = 4;
pub const ENDING_ABANDONED: i64 = 5;

// ---- what a command reports ------------------------------------------------

pub const MAX_EVENTS: usize = 48;
pub const EVENT_FIELDS: usize = 4;

/// Prices were thrown again. a: goods out of stock (bit mask).
pub const EV_PRICES: i64 = 1;
/// a: added to the debt, b: added to the deposit.
pub const EV_INTEREST: i64 = 2;
/// a: row of the market table, b: item, c: pieces put in the room.
pub const EV_MARKET: i64 = 3;
/// The room is full, the gift is lost. a: capacity.
pub const EV_NO_ROOM: i64 = 4;
/// a: row of the health table, b: points lost.
pub const EV_HURT: i64 = 5;
/// a: place (0..29), b: days in hospital, c: fee put on the debt.
pub const EV_COMA: i64 = 6;
pub const EV_CRISIS: i64 = 7;
pub const EV_DEATH: i64 = 8;
/// a: row of the money table, b: percent, c: 0 cash, 1 deposit.
pub const EV_ROBBED: i64 = 9;
/// a: change of the deposit (signed).
pub const EV_HACKER: i64 = 10;
pub const EV_CASH_ZERO: i64 = 11;
/// a: points lost.
pub const EV_BEATEN: i64 = 12;
pub const EV_LAST_DAY: i64 = 13;
pub const EV_TIME_UP: i64 = 14;
/// a: items held when the clock ran out (bit mask), b: cash received.
pub const EV_AUTO_SOLD: i64 = 15;
/// a: ending, b: net worth, c: place 1..=10 (0 when not placed).
pub const EV_ENDING: i64 = 16;
/// a: item, b: points lost, c: 1 the first time (the original says it once).
pub const EV_FAME: i64 = 17;
/// a: which of the five lines 村长 says when nothing is owed.
pub const EV_VILLAGE: i64 = 18;
/// a: new capacity, b: what it cost.
pub const EV_RENTED: i64 = 19;
pub const EV_RENT_DECLINED: i64 = 20;
/// a: yuan earned.
pub const EV_NET_GAIN: i64 = 21;
/// a: day reached (40 - days left) after the move, b: days that passed.
pub const EV_DAY: i64 = 22;

// ---- why a command was refused ---------------------------------------------

pub const OK: i32 = 0;
pub const E_NOT_PLAYING: i32 = 1;
pub const E_ARGUMENT: i32 = 2;
pub const E_SAME_PLACE: i32 = 3;
pub const E_SNAPSHOT: i32 = 4;
/// Out of stock here today.
pub const E_NO_GOODS: i32 = 10;
/// 俺的现金不够，银行又没有存款，咋办哩?
pub const E_BROKE: i32 = 11;
/// 俺带的现金不够，去银行提点钱吧。
pub const E_GO_BANK: i32 = 12;
pub const E_ROOM_FULL: i32 = 13;
pub const E_QUANTITY: i32 = 14;
pub const E_NOT_HELD: i32 = 20;
/// 哦？仿佛没有人在这里做…生意。
pub const E_NO_TRADE: i32 = 21;
pub const E_BANK: i32 = 30;
/// 小护士笑咪咪地望着俺
pub const E_HEALTHY: i32 = 40;
/// 钱不够哎! 拒绝治疗。
pub const E_HOSPITAL_POOR: i32 = 41;
/// 你还得起吗?
pub const E_CANT_PAY: i32 = 51;
pub const E_RENT_MAX: i32 = 60;
pub const E_RENT_POOR: i32 = 61;
pub const E_NET_POOR: i32 = 70;
pub const E_NET_TOO_MANY: i32 = 71;

pub const VENUE_BANK_DEPOSIT: i32 = 1;
pub const VENUE_BANK_WITHDRAW: i32 = 2;
pub const VENUE_HOSPITAL: i32 = 3;
pub const VENUE_POST: i32 = 4;
pub const VENUE_RENT: i32 = 5;
pub const VENUE_NET: i32 = 6;

pub const OPTION_HACKER: i32 = 1;
pub const OPTION_GROUND: i32 = 2;

pub struct Game {
    pub s: [i64; SLOTS],
    pub events: [[i64; EVENT_FIELDS]; MAX_EVENTS],
    pub event_count: usize,
}

impl Game {
    pub const fn empty() -> Game {
        Game { s: [0; SLOTS], events: [[0; EVENT_FIELDS]; MAX_EVENTS], event_count: 0 }
    }

    // -- the generator: Visual C++ 6 rand(), as the original linked it -------

    fn rand(&mut self) -> i64 {
        let next = (self.s[RNG] as u32).wrapping_mul(214_013).wrapping_add(2_531_011);
        self.s[RNG] = next as i64;
        ((next >> 16) & 0x7fff) as i64
    }

    /// The original's RandomNum: rand() % n.
    fn roll(&mut self, n: i64) -> i64 {
        self.rand() % n
    }

    fn emit(&mut self, kind: i64, a: i64, b: i64, c: i64) {
        if self.event_count < MAX_EVENTS {
            self.events[self.event_count] = [kind, a, b, c];
            self.event_count += 1;
        }
    }

    fn playing(&self) -> bool {
        self.s[STATUS] == STATUS_PLAYING
    }

    // -- new game (OnNewGame) ------------------------------------------------

    pub fn new_game(&mut self, seed: u32, hacker: bool) {
        let scores = self.scores();
        let had_scores = self.s[MAGIC_SLOT] == MAGIC;
        self.s = [0; SLOTS];
        self.event_count = 0;
        self.s[MAGIC_SLOT] = MAGIC;
        self.s[RNG] = seed as i64;
        self.s[SEED] = seed as i64;
        self.s[STATUS] = STATUS_PLAYING;
        self.s[DAYS] = START_DAYS;
        self.s[CASH] = START_CASH;
        self.s[DEBT] = START_DEBT;
        self.s[HEALTH] = START_HEALTH;
        self.s[FAME] = START_FAME;
        self.s[CAPACITY] = START_CAPACITY;
        self.s[HACKER] = hacker as i64;
        let table = if had_scores { scores } else { SCORE_SEEDS };
        self.set_scores(&table);
        // The original throws the prices and then charges interest once, so
        // the first debt the player sees is 5500.
        self.reroll(STOCKOUT_PICKS);
        self.interest();
    }

    pub fn scores(&self) -> [i64; 10] {
        let mut out = [0; 10];
        out.copy_from_slice(&self.s[SCORE_0..SCORE_0 + 10]);
        out
    }

    /// The local top ten the ending is ranked against (highest first).
    pub fn set_scores(&mut self, table: &[i64; 10]) {
        self.s[SCORE_0..SCORE_0 + 10].copy_from_slice(table);
        if self.s[MAGIC_SLOT] != MAGIC {
            self.s[MAGIC_SLOT] = MAGIC;
        }
    }

    // -- prices (makeDrugPrices) ----------------------------------------------

    fn reroll(&mut self, out_of_stock: i64) {
        for item in 0..8 {
            let (base, span) = PRICE[item];
            self.s[PRICE_0 + item] = base + self.roll(span);
        }
        let mut missing = 0;
        for _ in 0..out_of_stock {
            let item = self.roll(8) as usize;
            self.s[PRICE_0 + item] = 0;
            missing |= 1 << item;
        }
        self.emit(EV_PRICES, missing, 0, 0);
    }

    // -- interest (HandleCashAndDebt) --------------------------------------------

    fn interest(&mut self) {
        let debt = self.s[DEBT] * DEBT_PERCENT / 100;
        let deposit = self.s[DEPOSIT] * DEPOSIT_PERCENT / 100;
        self.s[DEBT] += debt;
        self.s[DEPOSIT] += deposit;
        self.emit(EV_INTEREST, debt, deposit, 0);
    }

    // -- one day (the ten OnLoc… handlers) ---------------------------------------------

    fn day(&mut self) {
        let before = self.s[DAYS];
        let picks = if before < STOCKOUT_LAST_DAYS_BELOW { 0 } else { STOCKOUT_PICKS };
        self.reroll(picks);
        self.interest();
        self.market_events();
        self.health_events();
        if !self.playing() {
            return;
        }
        self.money_events();
        if self.s[DEBT] > BEATING_DEBT_ABOVE {
            self.s[HEALTH] -= BEATING_DAMAGE;
            self.emit(EV_BEATEN, BEATING_DAMAGE, 0, 0);
        }
        self.s[DAYS] -= 1;
        self.s[TURN] += 1;
        self.emit(EV_DAY, START_DAYS - self.s[DAYS], before - self.s[DAYS], 0);
        if self.s[DAYS] == 1 {
            self.emit(EV_LAST_DAY, 0, 0, 0);
        }
        if self.s[DAYS] <= 0 {
            self.emit(EV_TIME_UP, 0, 0, 0);
            self.auto_sell();
            self.finish();
        }
    }

    // -- the market table (gameMessages) ------------------------------------

    fn market_events(&mut self) {
        for row in 0..MARKET_TABLE.len() {
            let (n, item, mul, div, add, debt) = MARKET_TABLE[row];
            let hit = self.roll(MARKET_ROLL) % n == 0;
            if !hit || self.s[PRICE_0 + item] == 0 {
                continue;
            }
            self.s[DEBT] += debt;
            if mul > 0 {
                self.s[PRICE_0 + item] *= mul;
            }
            if div > 0 {
                self.s[PRICE_0 + item] /= div;
            }
            let mut given = 0;
            if add > 0 {
                let room = self.s[CAPACITY] - self.s[USED];
                given = if add < room { add } else { room };
                if given <= 0 {
                    self.emit(EV_MARKET, row as i64, item as i64, 0);
                    self.emit(EV_NO_ROOM, self.s[CAPACITY], 0, 0);
                    // The original leaves the table here.
                    return;
                }
                if self.s[QTY_0 + item] == 0 {
                    self.s[COST_0 + item] = 0;
                }
                self.s[QTY_0 + item] += given;
                self.s[USED] += given;
            }
            self.emit(EV_MARKET, row as i64, item as i64, given);
        }
    }

    // -- the health table and the hospital bed (DoRandomEvent) ----------------

    fn health_events(&mut self) {
        for row in 0..HEALTH_TABLE.len() {
            let (n, damage) = HEALTH_TABLE[row];
            if self.roll(HEALTH_ROLL) % n == 0 {
                self.s[HEALTH] -= damage;
                self.emit(EV_HURT, row as i64, damage, 0);
                break;
            }
        }
        let health = self.s[HEALTH];
        if health < COMA_HEALTH_BELOW && self.s[DAYS] > COMA_DAYS_ABOVE {
            let days = self.roll(COMA_MAX_DAYS) + 1;
            let place = self.roll(COMA_PLACES);
            let fee = (self.roll(COMA_FEE_SPAN) + COMA_FEE_BASE) * days;
            self.s[HEALTH] += COMA_HEAL;
            if self.s[HEALTH] > 100 {
                self.s[HEALTH] = 100;
            }
            self.s[DEBT] += fee;
            self.s[DAYS] -= days;
            self.emit(EV_COMA, place, days, fee);
        } else if health < CRISIS_HEALTH_BELOW && health > 0 {
            self.emit(EV_CRISIS, 0, 0, 0);
        } else if health < 0 {
            self.emit(EV_DEATH, 0, 0, 0);
            self.s[NET] = self.net_worth();
            self.end(ENDING_DEAD);
        }
    }

    // -- the money table and the hacker (OnSteal) -----------------------

    fn money_events(&mut self) {
        for row in 0..MONEY_TABLE.len() {
            let (n, percent, hits_deposit) = MONEY_TABLE[row];
            if self.roll(MONEY_ROLL) % n != 0 {
                continue;
            }
            if hits_deposit {
                if self.s[DEPOSIT] < 1 {
                    break;
                }
                self.s[DEPOSIT] = self.s[DEPOSIT] / 100 * (100 - percent);
                self.emit(EV_ROBBED, row as i64, percent, 1);
            } else {
                self.s[CASH] = self.s[CASH] / 100 * (100 - percent);
                self.emit(EV_ROBBED, row as i64, percent, 0);
            }
            break;
        }
        let hit = self.roll(MONEY_ROLL) % HACKER_N == 0;
        if hit && self.s[HACKER] == 1 && self.s[DEPOSIT] >= HACKER_MIN_DEPOSIT {
            if self.s[DEPOSIT] < HACKER_SMALL_BELOW {
                let gain = self.s[DEPOSIT] / (self.roll(HACKER_SMALL_DIV) + 1);
                self.s[DEPOSIT] += gain;
                self.emit(EV_HACKER, gain, 0, 0);
            } else {
                let amount = self.s[DEPOSIT] / (self.roll(HACKER_BIG_DIV) + HACKER_BIG_DIV_BASE);
                if self.roll(HACKER_BIG_DIV) % HACKER_GAIN_MOD == 0 {
                    self.s[DEPOSIT] += amount;
                    self.emit(EV_HACKER, amount, 0, 0);
                } else {
                    self.s[DEPOSIT] -= amount;
                    self.emit(EV_HACKER, -amount, 0, 0);
                }
            }
        }
        if self.s[CASH] < 0 {
            self.s[CASH] = 0;
            self.emit(EV_CASH_ZERO, 0, 0, 0);
        }
    }

    // -- the end ---------------------------

    fn auto_sell(&mut self) {
        let mut held = 0;
        let mut received = 0;
        for item in 0..8 {
            let quantity = self.s[QTY_0 + item];
            if quantity == 0 {
                continue;
            }
            held |= 1 << item;
            let price = self.s[PRICE_0 + item];
            // Only what the market lists today is sold; the rest is lost.
            if price > 0 {
                received += quantity * price;
                self.s[USED] -= quantity;
                self.s[QTY_0 + item] = 0;
                self.s[COST_0 + item] = 0;
            }
        }
        if held != 0 {
            self.s[CASH] += received;
            self.emit(EV_AUTO_SOLD, held, received, 0);
        }
    }

    pub fn net_worth(&self) -> i64 {
        self.s[DEPOSIT] - self.s[DEBT] + self.s[CASH]
    }

    fn finish(&mut self) {
        let net = self.net_worth();
        self.s[NET] = net;
        if net < 1 {
            self.end(ENDING_DEPORTED);
            return;
        }
        // The first place whose score is not above ours.
        let mut place = 0;
        while place < 10 && net < self.s[SCORE_0 + place] {
            place += 1;
        }
        if place >= 10 {
            self.end(ENDING_UNRANKED);
            return;
        }
        let mut index = 9;
        while index > place {
            self.s[SCORE_0 + index] = self.s[SCORE_0 + index - 1];
            index -= 1;
        }
        self.s[SCORE_0 + place] = net;
        self.s[RANK] = place as i64 + 1;
        // The original picks one of five honours with a bare rand() % 5.
        self.s[TITLE] = self.rand() % TITLES;
        self.end(ENDING_RANKED);
    }

    fn end(&mut self, ending: i64) {
        self.s[STATUS] = STATUS_OVER;
        self.s[ENDING] = ending;
        self.emit(EV_ENDING, ending, self.s[NET], self.s[RANK]);
    }

    // -- commands ------------------------------------------------------------

    /// Go to one of the ten places (1..=10). One move is one day.
    pub fn go(&mut self, place: i32) -> i32 {
        self.event_count = 0;
        if !self.playing() {
            return E_NOT_PLAYING;
        }
        if !(1..=10).contains(&place) {
            return E_ARGUMENT;
        }
        if self.s[LOCATION] == place as i64 {
            return E_SAME_PLACE;
        }
        self.s[LOCATION] = place as i64;
        self.day();
        OK
    }

    /// The most that can be bought now, or the reason nothing can (negative).
    pub fn max_buy(&self, item: i32) -> i32 {
        if !self.playing() {
            return -E_NOT_PLAYING;
        }
        if !(0..8).contains(&item) {
            return -E_ARGUMENT;
        }
        let price = self.s[PRICE_0 + item as usize];
        if price == 0 {
            return -E_NO_GOODS;
        }
        if self.s[CASH] < price {
            return if self.s[DEPOSIT] < 1 { -E_BROKE } else { -E_GO_BANK };
        }
        let afford = self.s[CASH] / price;
        let room = self.s[CAPACITY] - self.s[USED];
        let most = if afford < room { afford } else { room };
        if most <= 0 {
            return -E_ROOM_FULL;
        }
        if most > i32::MAX as i64 { i32::MAX } else { most as i32 }
    }

    /// Buying: OnAdd and the first half of MoveListItems.
    pub fn buy(&mut self, item: i32, quantity: i32) -> i32 {
        self.event_count = 0;
        let most = self.max_buy(item);
        if most < 0 {
            return -most;
        }
        if quantity < 1 || quantity > most {
            return E_QUANTITY;
        }
        let item = item as usize;
        let quantity = quantity as i64;
        let price = self.s[PRICE_0 + item];
        let held = self.s[QTY_0 + item];
        // The room shows one average cost for each kind of goods.
        self.s[COST_0 + item] = (self.s[COST_0 + item] * held + price * quantity) / (held + quantity);
        self.s[QTY_0 + item] = held + quantity;
        self.s[USED] += quantity;
        self.s[CASH] -= price * quantity;
        OK
    }

    /// The second half of MoveListItems.
    pub fn sell(&mut self, item: i32, quantity: i32) -> i32 {
        self.event_count = 0;
        if !self.playing() {
            return E_NOT_PLAYING;
        }
        if !(0..8).contains(&item) {
            return E_ARGUMENT;
        }
        let item = item as usize;
        let held = self.s[QTY_0 + item];
        if held == 0 {
            return E_NOT_HELD;
        }
        let price = self.s[PRICE_0 + item];
        if price == 0 {
            return E_NO_TRADE;
        }
        if quantity < 1 || quantity as i64 > held {
            return E_QUANTITY;
        }
        let quantity = quantity as i64;
        self.s[CASH] += price * quantity;
        self.s[QTY_0 + item] = held - quantity;
        self.s[USED] -= quantity;
        if self.s[QTY_0 + item] == 0 {
            self.s[COST_0 + item] = 0;
        }
        let lost = -FAME_ON_SELL[item];
        if lost > 0 {
            let bit = if item == 4 { 1 } else { 2 };
            let first = self.s[FLAGS] & bit == 0;
            self.s[FLAGS] |= bit;
            self.s[FAME] -= lost;
            if self.s[FAME] < 0 {
                self.s[FAME] = 0;
            }
            self.emit(EV_FAME, item as i64, lost, first as i64);
        }
        OK
    }

    /// What 扁子居 says the bigger room costs (it takes 2000 more).
    pub fn rent_quote(&self) -> i64 {
        if self.s[CASH] > RENT_MIN_CASH { self.s[CASH] / 2 } else { RENT_FLAT_QUOTE }
    }

    /// The five places of business. None of them costs a day.
    pub fn visit(&mut self, venue: i32, argument: i64) -> i32 {
        self.event_count = 0;
        if !self.playing() {
            return E_NOT_PLAYING;
        }
        match venue {
            VENUE_BANK_DEPOSIT => {
                if argument < 1 || argument > self.s[CASH] {
                    return E_BANK;
                }
                self.s[CASH] -= argument;
                self.s[DEPOSIT] += argument;
                OK
            }
            VENUE_BANK_WITHDRAW => {
                if argument < 1 || argument > self.s[DEPOSIT] {
                    return E_BANK;
                }
                self.s[DEPOSIT] -= argument;
                self.s[CASH] += argument;
                OK
            }
            // OnHospital
            VENUE_HOSPITAL => {
                if self.s[HEALTH] >= 100 {
                    return E_HEALTHY;
                }
                if argument < 1 || argument > 100 - self.s[HEALTH] {
                    return E_QUANTITY;
                }
                let fee = argument * HOSPITAL_PRICE;
                if fee > self.s[CASH] {
                    return E_HOSPITAL_POOR;
                }
                self.s[HEALTH] += argument;
                self.s[CASH] -= fee;
                OK
            }
            // OnPostoffice
            VENUE_POST => {
                if self.s[DEBT] == 0 {
                    let wealth = self.s[DEPOSIT] + self.s[CASH];
                    let line = if wealth < 1_000 {
                        0
                    } else if wealth < 100_000 && wealth > 1_000 {
                        1
                    } else if wealth < 10_000_000 && wealth > 100_000 {
                        2
                    } else if wealth < 10_000_001 {
                        3
                    } else {
                        4
                    };
                    self.emit(EV_VILLAGE, line, 0, 0);
                    return OK;
                }
                if argument < 1 || argument > self.s[DEBT] {
                    return E_ARGUMENT;
                }
                if argument > self.s[CASH] {
                    return E_CANT_PAY;
                }
                self.s[DEBT] -= argument;
                self.s[CASH] -= argument;
                OK
            }
            // OnHouseAgency
            VENUE_RENT => {
                if self.s[CAPACITY] >= CAPACITY_MAX {
                    return E_RENT_MAX;
                }
                if self.s[CASH] < RENT_MIN_CASH {
                    return E_RENT_POOR;
                }
                if argument != 1 {
                    self.emit(EV_RENT_DECLINED, 0, 0, 0);
                    return OK;
                }
                let cash = self.s[CASH];
                let left = if cash <= RENT_MIN_CASH { cash - RENT_FLAT_CHARGE } else { cash / 2 - RENT_CHEAT };
                self.s[CASH] = left;
                self.s[CAPACITY] += CAPACITY_STEP;
                self.emit(EV_RENTED, self.s[CAPACITY], cash - left, 0);
                OK
            }
            // OnWangba
            VENUE_NET => {
                if self.s[NET_VISITS] >= NET_MAX_VISITS {
                    return E_NET_TOO_MANY;
                }
                if self.s[CASH] < NET_MIN_CASH {
                    return E_NET_POOR;
                }
                self.s[NET_VISITS] += 1;
                let gain = self.roll(NET_GAIN_SPAN) + 1;
                self.s[CASH] += gain;
                self.emit(EV_NET_GAIN, gain, 0, 0);
                OK
            }
            _ => E_ARGUMENT,
        }
    }

    pub fn set_option(&mut self, option: i32, value: i32) -> i32 {
        let on = (value != 0) as i64;
        match option {
            OPTION_HACKER => self.s[HACKER] = on,
            OPTION_GROUND => self.s[GROUND] = on,
            _ => return E_ARGUMENT,
        }
        OK
    }

    /// Leave Beijing before the forty days are over. Nothing is ranked.
    pub fn abandon(&mut self) -> i32 {
        self.event_count = 0;
        if !self.playing() {
            return E_NOT_PLAYING;
        }
        self.s[NET] = self.net_worth();
        self.end(ENDING_ABANDONED);
        OK
    }

    // -- snapshots -----------------------------------------------------------

    pub fn snapshot(&self, out: &mut [u8]) -> usize {
        if out.len() < SNAPSHOT_BYTES {
            return 0;
        }
        for (slot, value) in self.s.iter().enumerate() {
            out[slot * 8..slot * 8 + 8].copy_from_slice(&value.to_le_bytes());
        }
        SNAPSHOT_BYTES
    }

    pub fn restore(&mut self, bytes: &[u8]) -> i32 {
        if bytes.len() != SNAPSHOT_BYTES {
            return E_SNAPSHOT;
        }
        let mut next = [0i64; SLOTS];
        for (slot, value) in next.iter_mut().enumerate() {
            let mut raw = [0u8; 8];
            raw.copy_from_slice(&bytes[slot * 8..slot * 8 + 8]);
            *value = i64::from_le_bytes(raw);
        }
        let sane = next[MAGIC_SLOT] == MAGIC
            && (STATUS_NONE..=STATUS_OVER).contains(&next[STATUS])
            && (ENDING_NONE..=ENDING_ABANDONED).contains(&next[ENDING])
            && (0..=10).contains(&next[LOCATION])
            && (0..=START_DAYS).contains(&next[DAYS])
            && (START_CAPACITY..=CAPACITY_MAX).contains(&next[CAPACITY])
            && (0..=next[CAPACITY]).contains(&next[USED])
            && next[RNG] >= 0
            && next[RNG] <= u32::MAX as i64
            && (0..8).all(|item| next[PRICE_0 + item] >= 0 && next[QTY_0 + item] >= 0 && next[COST_0 + item] >= 0)
            && (0..8).map(|item| next[QTY_0 + item]).sum::<i64>() == next[USED];
        if !sane {
            return E_SNAPSHOT;
        }
        self.s = next;
        self.event_count = 0;
        OK
    }
}

// ---- the wasm surface --------------------------------------------------------
//
// One game, one buffer. The page writes a snapshot or a score table into the
// buffer and reads snapshots and events back out of linear memory.

#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::*;
    use core::ptr::addr_of_mut;

    static mut GAME: Game = Game::empty();
    static mut BUFFER: [u8; SNAPSHOT_BYTES] = [0; SNAPSHOT_BYTES];

    #[panic_handler]
    fn panic(_: &core::panic::PanicInfo) -> ! {
        core::arch::wasm32::unreachable()
    }

    fn game() -> &'static mut Game {
        // One thread, and no export calls another: the reference never overlaps.
        unsafe { &mut *addr_of_mut!(GAME) }
    }

    fn buffer() -> &'static mut [u8; SNAPSHOT_BYTES] {
        unsafe { &mut *addr_of_mut!(BUFFER) }
    }

    #[no_mangle]
    pub extern "C" fn bf_buffer() -> *mut u8 {
        buffer().as_mut_ptr()
    }

    #[no_mangle]
    pub extern "C" fn bf_state() -> *const i64 {
        game().s.as_ptr()
    }

    #[no_mangle]
    pub extern "C" fn bf_events() -> *const i64 {
        game().events.as_ptr() as *const i64
    }

    #[no_mangle]
    pub extern "C" fn bf_event_count() -> i32 {
        game().event_count as i32
    }

    /// Ten little-endian i64 in the buffer, highest first.
    #[no_mangle]
    pub extern "C" fn bf_set_scores() {
        let mut table = [0i64; 10];
        for (place, value) in table.iter_mut().enumerate() {
            let mut raw = [0u8; 8];
            raw.copy_from_slice(&buffer()[place * 8..place * 8 + 8]);
            *value = i64::from_le_bytes(raw);
        }
        game().set_scores(&table);
    }

    #[no_mangle]
    pub extern "C" fn bf_new_game(seed: u32, hacker: i32) {
        game().new_game(seed, hacker != 0);
    }

    #[no_mangle]
    pub extern "C" fn bf_snapshot() -> i32 {
        game().snapshot(buffer()) as i32
    }

    #[no_mangle]
    pub extern "C" fn bf_restore(length: i32) -> i32 {
        if length != SNAPSHOT_BYTES as i32 {
            return E_SNAPSHOT;
        }
        let bytes = *buffer();
        game().restore(&bytes)
    }

    #[no_mangle]
    pub extern "C" fn bf_move(place: i32) -> i32 {
        game().go(place)
    }

    #[no_mangle]
    pub extern "C" fn bf_max_buy(item: i32) -> i32 {
        game().max_buy(item)
    }

    #[no_mangle]
    pub extern "C" fn bf_buy(item: i32, quantity: i32) -> i32 {
        game().buy(item, quantity)
    }

    #[no_mangle]
    pub extern "C" fn bf_sell(item: i32, quantity: i32) -> i32 {
        game().sell(item, quantity)
    }

    #[no_mangle]
    pub extern "C" fn bf_rent_quote() -> i64 {
        game().rent_quote()
    }

    #[no_mangle]
    pub extern "C" fn bf_visit(venue: i32, argument: i64) -> i32 {
        game().visit(venue, argument)
    }

    #[no_mangle]
    pub extern "C" fn bf_set_option(option: i32, value: i32) -> i32 {
        game().set_option(option, value)
    }

    #[no_mangle]
    pub extern "C" fn bf_end() -> i32 {
        game().abandon()
    }
}
