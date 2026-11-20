// The redrawn art (art/, written by tools/build-art.mjs). Seven icons and
// four pictures are the whole graphic vocabulary of the game.

import diary from "../../art/bitmaps/diary.svg";
import news from "../../art/bitmaps/news.svg";
import bulb from "../../art/icons/bulb.svg";
import bulb16 from "../../art/icons/bulb-16.svg";
import card from "../../art/icons/card.svg";
import card16 from "../../art/icons/card-16.svg";
import city from "../../art/icons/city.svg";
import city16 from "../../art/icons/city-16.svg";
import goods from "../../art/icons/goods.svg";
import goods16 from "../../art/icons/goods-16.svg";
import hospital from "../../art/icons/hospital.svg";
import house from "../../art/icons/house.svg";
import house16 from "../../art/icons/house-16.svg";
import letter from "../../art/icons/letter.svg";
import letter16 from "../../art/icons/letter-16.svg";

export type IconName = "city" | "goods" | "house" | "bulb" | "letter" | "card" | "hospital";

const MASTER: Record<IconName, string> = { city, goods, house, bulb, letter, card, hospital };
/** The simplified cut, for 16 px. */
const SMALL: Record<IconName, string> = {
  city: city16,
  goods: goods16,
  house: house16,
  bulb: bulb16,
  letter: letter16,
  card: card16,
  hospital,
};

/** Decorative: the words beside an icon always say what it stands for. */
export function Icon({ name, size }: { name: IconName; size: number }) {
  return (
    <img class="bf-icon" src={size <= 16 ? SMALL[name] : MASTER[name]} width={size} height={size} alt="" aria-hidden />
  );
}

export function Art({ name }: { name: "news" | "diary" }) {
  return <img class="bf-art" src={name === "news" ? news : diary} alt="" aria-hidden />;
}
