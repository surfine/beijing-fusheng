import { describe, expect, it } from "vitest";
import {
  dialog,
  endingLines,
  fameName,
  pagesFor,
  placeName,
  rules,
  sprintf,
  text,
  windowTitle,
} from "../../src/game/text.ts";
import { Ending, Ev, type View } from "../../src/kernel/kernel.ts";

const view = (patch: Partial<View>): View => ({
  status: 1,
  ending: 0,
  daysLeft: 37,
  cash: 2000,
  debt: 5500,
  deposit: 0,
  health: 100,
  fame: 100,
  capacity: 100,
  used: 0,
  location: 1,
  ground: false,
  hacker: false,
  netVisits: 0,
  net: 0,
  rank: 0,
  title: 0,
  seed: 1,
  goods: [],
  scores: [],
  ...patch,
});

describe("the original's words", () => {
  it("formats like the original's printf", () => {
    expect(windowTitle(37)).toBe("北京浮生(3/40天)");
    expect(sprintf(text.buyMax, 2000, 6)).toBe("2000元人民币,最多可以买6个");
    expect(sprintf(text.cashLost, 10)).toBe("俺的银子减少了10%。");
    expect(sprintf("(%03d , ", 1)).toBe("(001 , ");
  });

  it("keeps the author's typos and punctuation", () => {
    const story = dialog(166).lines.join("");
    expect(story).toContain("您将体念在北京卖盗版VCD");
    expect(text.boss.lines.join("")).toContain("不要自做主张");
    expect(dialog(145).lines.join("")).toContain("死不认帐药");
    expect(dialog(102).lines.join("")).toContain("还欠村长5400元高利贷");
    expect(rules.items.map((item) => item.name)).toEqual([
      "进口香烟",
      "走私汽车",
      "盗版VCD、游戏",
      "假白酒（剧毒！）",
      "《上海小宝贝》（禁书）",
      "进口玩具",
      "水货手机",
      "伪劣化妆品",
    ]);
  });

  it("names the ten places on both maps", () => {
    expect([3, 7, 5, 1, 2, 4, 8, 6, 9, 10].map((place) => placeName(place, false))).toEqual([
      "西直门",
      "积水潭",
      "东直门",
      "建国门",
      "北京站",
      "崇文门",
      "长椿街",
      "复兴门",
      "公主坟",
      "苹果园",
    ]);
    expect(placeName(3, true)).toBe("海淀大街");
  });

  it("maps fame to the seven names", () => {
    expect([0, 20, 40, 60, 80, 90, 100].map(fameName)).toEqual([
      "江湖唾弃",
      "差",
      "争议人物",
      "不佳",
      "一般般",
      "杰出青年",
      "德高望重",
    ]);
  });

  it("tells news from the diary, in full", () => {
    const pages = pagesFor(
      [
        { kind: Ev.market, a: 7, b: 7, c: 0 },
        { kind: Ev.hurt, a: 11, b: 1, c: 0 },
        { kind: Ev.robbed, a: 4, b: 15, c: 1 },
        { kind: Ev.coma, a: 0, b: 2, c: 5000 },
      ],
      view({ location: 5, ground: true }),
    );
    expect(pages.map((page) => page.kind)).toEqual(["news", "diary", "diary", "diary"]);
    expect(pages[0]?.lines).toEqual(["谢不疯在晚会上说：“我酷!我使用伪劣化妆品!”，伪劣化妆品供不应求!"]);
    expect(pages[1]?.lines).toEqual(["申奥添了新风景，北京又来沙尘暴!俺的健康减少了1点。"]);
    expect(pages[2]?.lines).toEqual(["两个猛男揪住俺：“交长话附加费、上网费。”俺的存款减少了15%。，哎呀!"]);
    expect(pages[3]?.lines).toEqual([
      "由于不注意身体,我被人发现昏迷在三元东桥附近的发廊里。",
      "好心的市民把我抬到医院，医生让我治疗2天。",
      "村长让人为我垫付了住院费用5000元。",
    ]);
  });

  it("words the endings as the original did", () => {
    expect(endingLines(view({ ending: Ending.deported, net: -5 }), "")).toEqual([
      "《北京游戏报》报道: 玩家“无名氏”在北京没挣着钱，被遣送回家。",
    ]);
    expect(endingLines(view({ ending: Ending.dead }), "铁牛")).toEqual([
      '俺倒在街头,身边日记本上写着："北京，我将再来!"',
    ]);
    expect(endingLines(view({ ending: Ending.ranked, net: 1688902, rank: 2, title: 4 }), "铁牛")).toEqual([
      "恭喜恭喜! “北京金钱年鉴”通知您：",
      "您的财富1688902人民币已经进入北京富人前2名。",
      "您还被授予“北京第一金手指”。",
      "历史将永远记住您白手起家、劳动致富的光辉事迹。",
    ]);
  });
});
