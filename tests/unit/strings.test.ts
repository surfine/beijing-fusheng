import { describe, expect, expectTypeOf, it } from "vitest";
import manifest from "../../public/app.manifest.json";
import { APP_VERSION } from "../../src/bridge/bridge.ts";
import { en } from "../../src/strings/en.ts";
import { type StringKey, translate } from "../../src/strings/index.ts";
import { zh } from "../../src/strings/zh.ts";

describe("strings", () => {
  it("rejects a misspelled key at compile time", () => {
    expectTypeOf<"app_title">().toMatchTypeOf<StringKey>();
    // @ts-expect-error -- not a key of the English table.
    const misspelled: StringKey = "app_titel";
    expect(misspelled).toBe("app_titel");
  });

  it("has every English key in Chinese", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it("names the window the way the manifest does, in both languages", () => {
    expect(translate("en", "app_title")).toBe(manifest.strings.en.app_title);
    expect(translate("zh", "app_title")).toBe(manifest.strings.zh.app_title);
  });

  it("fills placeholders", () => {
    expect(translate("zh", "held", { count: 37 })).toBe("屋里 37");
    expect(translate("en", "now_each", { price: 512, delta: "+110" })).toBe("now 512, +110 each");
  });

  it("gives every menu label in the manifest in both languages", () => {
    expect(Object.keys(manifest.strings.zh).sort()).toEqual(Object.keys(manifest.strings.en).sort());
  });
});

describe("versions", () => {
  it("connects with the manifest's version, or the desk refuses the hello", () => {
    expect(APP_VERSION).toBe(manifest.version);
  });
});
