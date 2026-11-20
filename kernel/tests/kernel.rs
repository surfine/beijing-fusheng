//! Seeded runs of the whole game. The same seed and the same commands must
//! give the same bytes; three scripted players must reach the three endings.

use beijing_kernel::tables::*;
use beijing_kernel::*;

fn snapshot(game: &Game) -> Vec<u8> {
    let mut out = vec![0u8; SNAPSHOT_BYTES];
    assert_eq!(game.snapshot(&mut out), SNAPSHOT_BYTES);
    out
}

fn new(seed: u32) -> Game {
    let mut game = Game::empty();
    game.new_game(seed, false);
    game
}

/// Visits the ten places in turn; `act` trades before each move.
fn play(seed: u32, mut act: impl FnMut(&mut Game)) -> Game {
    let mut game = new(seed);
    let mut place = 1;
    let mut moves = 0;
    while game.s[STATUS] == STATUS_PLAYING {
        act(&mut game);
        assert_eq!(game.go(place), OK);
        place = place % 10 + 1;
        moves += 1;
        assert!(moves <= 40, "a game never lasts more than forty moves");
    }
    game
}

/// Buys what is cheap for its range, sells what is dear, pays 村长 first.
fn trader(game: &mut Game) {
    for item in 0..8usize {
        let price = game.s[PRICE_0 + item];
        let (base, span) = PRICE[item];
        if price > base + span / 2 && game.s[QTY_0 + item] > 0 {
            assert_eq!(game.sell(item as i32, game.s[QTY_0 + item] as i32), OK);
        }
    }
    if game.s[DEBT] > 0 && game.s[CASH] > game.s[DEBT] + 3000 {
        assert_eq!(game.visit(VENUE_POST, game.s[DEBT]), OK);
    }
    // Dearest goods first: the money sits where the spread is.
    for item in [1usize, 4, 3, 6, 5, 0, 7, 2] {
        let price = game.s[PRICE_0 + item];
        let (base, span) = PRICE[item];
        if price > 0 && price < base + span / 3 {
            let most = game.max_buy(item as i32);
            if most > 0 {
                assert_eq!(game.buy(item as i32, most), OK);
            }
        }
    }
}

#[test]
fn the_generator_is_visual_c_rand() {
    // srand(1); rand() x5 on Visual C++ 6.
    let mut game = Game::empty();
    game.s[RNG] = 1;
    let mut seen = Vec::new();
    for _ in 0..5 {
        // roll(32768) is rand() itself.
        game.s[RNG] = (game.s[RNG] as u32).wrapping_mul(214_013).wrapping_add(2_531_011) as i64;
        seen.push((game.s[RNG] >> 16) & 0x7fff);
    }
    assert_eq!(seen, [41, 18467, 6334, 26500, 19169]);
}

#[test]
fn a_new_game_shows_the_debt_after_one_day_of_interest() {
    let game = new(20010103);
    assert_eq!(game.s[CASH], 2000);
    assert_eq!(game.s[DEBT], 5500);
    assert_eq!(game.s[DEPOSIT], 0);
    assert_eq!(game.s[HEALTH], 100);
    assert_eq!(game.s[DAYS], 40);
    assert_eq!(game.s[CAPACITY], 100);
}

#[test]
fn prices_stay_in_their_ranges_and_at_most_three_goods_are_missing() {
    for seed in 0..500 {
        let mut game = new(seed);
        for step in 0..12 {
            // The throw itself leaves at most three goods out. A later ÷8 can
            // floor a cheap price to 0 as well (盗版VCD at 5), as in the original.
            assert_eq!(game.events[0][0], EV_PRICES);
            assert!(game.events[0][1].count_ones() <= 3);
            if step == 0 {
                assert!((0..8).filter(|item| game.s[PRICE_0 + item] == 0).count() <= 3);
                // Before any event has multiplied or divided a price.
                for item in 0..8 {
                    let price = game.s[PRICE_0 + item];
                    let (base, span) = PRICE[item];
                    assert!(price == 0 || (base..base + span).contains(&price));
                }
            }
            if game.go(step % 10 + 1) != OK {
                break;
            }
        }
    }
}

#[test]
fn the_same_seed_and_commands_give_the_same_bytes() {
    for seed in [1u32, 42, 20010103, 0xdead_beef] {
        let first = play(seed, trader);
        let second = play(seed, trader);
        assert_eq!(snapshot(&first), snapshot(&second), "seed {seed}");
        assert_ne!(snapshot(&first), snapshot(&play(seed.wrapping_add(1), trader)));
    }
}

#[test]
fn a_restored_game_continues_exactly_like_the_one_it_was_taken_from() {
    let mut original = new(77);
    for place in 1..=7 {
        trader(&mut original);
        assert_eq!(original.go(place), OK);
    }
    let saved = snapshot(&original);
    let mut copy = Game::empty();
    assert_eq!(copy.restore(&saved), OK);
    let mut place = 8;
    while original.s[STATUS] == STATUS_PLAYING {
        trader(&mut original);
        trader(&mut copy);
        assert_eq!(original.go(place), copy.go(place));
        assert_eq!(snapshot(&original), snapshot(&copy));
        place = place % 10 + 1;
    }
    assert_eq!(copy.restore(&saved[1..]), E_SNAPSHOT);
    let mut broken = saved.clone();
    broken[0] ^= 1;
    assert_eq!(copy.restore(&broken), E_SNAPSHOT);
}

#[test]
fn forty_days_reach_the_three_endings() {
    let mut ranked = None;
    let mut deported = None;
    let mut dead = None;
    for seed in 1..400u32 {
        if ranked.is_none() {
            let game = play(seed, trader);
            if game.s[ENDING] == ENDING_RANKED {
                assert!(game.s[NET] >= 1 && (1..=10).contains(&game.s[RANK]));
                assert_eq!(game.s[SCORE_0 + game.s[RANK] as usize - 1], game.s[NET]);
                ranked = Some((seed, game.s[NET], game.s[RANK]));
            }
        }
        // Someone who never trades: the debt alone decides.
        let idle = play(seed, |_| {});
        match idle.s[ENDING] {
            ENDING_DEPORTED if deported.is_none() => {
                assert!(idle.s[NET] < 1 && idle.s[DAYS] == 0);
                deported = Some((seed, idle.s[NET]));
            }
            ENDING_DEAD if dead.is_none() => {
                assert!(idle.s[HEALTH] < 0 && idle.s[DAYS] > 0);
                dead = Some((seed, idle.s[DAYS]));
            }
            _ => {}
        }
    }
    println!("ranked {ranked:?} deported {deported:?} dead {dead:?}");
    assert!(ranked.is_some(), "no seed below 400 put the trader on the list");
    assert!(deported.is_some(), "no seed below 400 sent the idler home");
    assert!(dead.is_some(), "no seed below 400 left the idler in the street");
}

#[test]
fn events_are_rare_and_match_the_table_rates() {
    let (mut market, mut hurt, mut robbed, mut days) = (0f64, 0f64, 0f64, 0f64);
    for seed in 0..3000u32 {
        let mut game = new(seed);
        // Only the first move of each game: no coma, no empty deposit yet.
        assert_eq!(game.go(1), OK);
        days += 1.0;
        for index in 0..game.event_count {
            match game.events[index][0] {
                EV_MARKET => market += 1.0,
                EV_HURT => hurt += 1.0,
                EV_ROBBED => robbed += 1.0,
                _ => {}
            }
        }
    }
    println!("per day: market {:.3} hurt {:.3} robbed {:.3}", market / days, hurt / days, robbed / days);
    assert!((0.35..0.60).contains(&(market / days)));
    assert!((0.18..0.30).contains(&(hurt / days)));
    assert!((0.06..0.16).contains(&(robbed / days)));
}

#[test]
fn trading_follows_the_original_refusals() {
    let mut game = new(5);
    game.s[PRICE_0 + 2] = 10; // 盗版VCD
    game.s[PRICE_0 + 1] = 20000; // 走私汽车
    game.s[PRICE_0 + 0] = 0; // 进口香烟: out of stock
    assert_eq!(game.buy(0, 1), E_NO_GOODS);
    assert_eq!(game.buy(1, 1), E_BROKE);
    game.s[DEPOSIT] = 1;
    assert_eq!(game.buy(1, 1), E_GO_BANK);
    assert_eq!(game.max_buy(2), 100); // 2000 / 10 = 200, the room holds 100
    assert_eq!(game.buy(2, 101), E_QUANTITY);
    assert_eq!(game.buy(2, 40), OK);
    game.s[PRICE_0 + 2] = 30;
    assert_eq!(game.buy(2, 20), OK);
    assert_eq!(game.s[COST_0 + 2], (10 * 40 + 30 * 20) / 60);
    assert_eq!(game.s[CASH], 2000 - 400 - 600);
    assert_eq!(game.sell(0, 1), E_NOT_HELD);
    game.s[PRICE_0 + 2] = 0;
    assert_eq!(game.sell(2, 1), E_NO_TRADE);
    game.s[PRICE_0 + 2] = 50;
    assert_eq!(game.sell(2, 61), E_QUANTITY);
    assert_eq!(game.sell(2, 60), OK);
    assert_eq!((game.s[USED], game.s[CASH], game.s[COST_0 + 2]), (0, 4000, 0));
}

#[test]
fn selling_the_banned_book_and_the_poison_costs_fame_and_says_so_once() {
    let mut game = new(9);
    game.s[CASH] = 1_000_000;
    game.s[PRICE_0 + 4] = 6000;
    game.s[PRICE_0 + 3] = 2000;
    assert_eq!(game.buy(4, 3), OK);
    assert_eq!(game.buy(3, 3), OK);
    assert_eq!(game.sell(4, 1), OK);
    assert_eq!(game.events[0], [EV_FAME, 4, 7, 1]);
    assert_eq!(game.sell(4, 1), OK);
    assert_eq!(game.events[0], [EV_FAME, 4, 7, 0]);
    assert_eq!(game.sell(3, 1), OK);
    assert_eq!(game.events[0], [EV_FAME, 3, 10, 1]);
    assert_eq!(game.s[FAME], 100 - 7 - 7 - 10);
}

#[test]
fn the_five_places_of_business_charge_what_the_original_charged() {
    let mut game = new(3);
    assert_eq!(game.visit(VENUE_HOSPITAL, 1), E_HEALTHY);
    game.s[HEALTH] = 90;
    assert_eq!(game.visit(VENUE_HOSPITAL, 11), E_QUANTITY);
    assert_eq!(game.visit(VENUE_HOSPITAL, 1), E_HOSPITAL_POOR); // 3500 > 2000
    game.s[CASH] = 7000;
    assert_eq!(game.visit(VENUE_HOSPITAL, 2), OK);
    assert_eq!((game.s[HEALTH], game.s[CASH]), (92, 0));

    game.s[CASH] = 29_999;
    assert_eq!(game.visit(VENUE_RENT, 1), E_RENT_POOR);
    game.s[CASH] = 30_000;
    assert_eq!(game.rent_quote(), 20_000);
    assert_eq!(game.visit(VENUE_RENT, 1), OK);
    assert_eq!((game.s[CAPACITY], game.s[CASH]), (110, 5_000));
    game.s[CASH] = 100_000;
    assert_eq!(game.rent_quote(), 50_000);
    assert_eq!(game.visit(VENUE_RENT, 1), OK);
    assert_eq!((game.s[CAPACITY], game.s[CASH]), (120, 48_000)); // quoted 50000, took 52000
    game.s[CAPACITY] = 140;
    assert_eq!(game.visit(VENUE_RENT, 1), E_RENT_MAX);

    game.s[CASH] = 14;
    assert_eq!(game.visit(VENUE_NET, 0), E_NET_POOR);
    game.s[CASH] = 15;
    for _ in 0..3 {
        let before = game.s[CASH];
        assert_eq!(game.visit(VENUE_NET, 0), OK);
        assert!((1..=10).contains(&(game.s[CASH] - before)));
    }
    assert_eq!(game.visit(VENUE_NET, 0), E_NET_TOO_MANY);

    game.s[CASH] = 6000;
    assert_eq!(game.visit(VENUE_POST, 6001), E_ARGUMENT); // more than is owed
    assert_eq!(game.visit(VENUE_POST, 5500), OK);
    assert_eq!((game.s[DEBT], game.s[CASH]), (0, 500));
    assert_eq!(game.visit(VENUE_POST, 0), OK);
    assert_eq!(game.events[0], [EV_VILLAGE, 0, 0, 0]); // 你没钱,有神经病!
    assert_eq!(game.visit(VENUE_BANK_DEPOSIT, 501), E_BANK);
    assert_eq!(game.visit(VENUE_BANK_DEPOSIT, 500), OK);
    assert_eq!(game.visit(VENUE_BANK_WITHDRAW, 200), OK);
    assert_eq!((game.s[CASH], game.s[DEPOSIT]), (200, 300));
}

#[test]
fn a_debt_over_a_hundred_thousand_gets_you_beaten_every_day() {
    let mut game = new(11);
    game.s[DEBT] = 200_000;
    assert_eq!(game.go(1), OK);
    assert!(game.events[..game.event_count].iter().any(|event| event[0] == EV_BEATEN && event[1] == 30));
}

#[test]
fn nothing_moves_after_the_end() {
    let mut game = play(8, |_| {});
    let before = snapshot(&game);
    assert_eq!(game.go(1), E_NOT_PLAYING);
    assert_eq!(game.buy(2, 1), E_NOT_PLAYING);
    assert_eq!(game.visit(VENUE_NET, 0), E_NOT_PLAYING);
    assert_eq!(game.abandon(), E_NOT_PLAYING);
    assert_eq!(snapshot(&game), before);
}
