import { describe, expect, it } from "vitest";
import az from "../../messages/az.json";
import en from "../../messages/en.json";
import { localeFromAcceptLanguage } from "@/i18n/config";

type Tree = { [k: string]: string | Tree };
const keys = (o: Tree, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : keys(v, `${p}${k}.`)));

describe("messages", () => {
  it("az and en have exactly the same keys", () => {
    expect(keys(az as Tree).sort()).toEqual(keys(en as Tree).sort());
  });
  it("uses the brief's labels", () => {
    expect(az.nav.settings).toBe("Parametrlər");
    expect(az.filter.upcoming).toBe("Yaxın tarix");
    expect(az.voice.button).toBe("Səsli versiya");
    expect(en.action.create).toBe("Create Task");
  });
});

describe("localeFromAcceptLanguage", () => {
  it("prefers az when ranked first", () => expect(localeFromAcceptLanguage("az-AZ,en;q=0.8")).toBe("az"));
  it("falls back to en for other languages", () => expect(localeFromAcceptLanguage("de-DE,fr;q=0.5")).toBe("en"));
  it("respects q values", () => expect(localeFromAcceptLanguage("en;q=0.4,az;q=0.9")).toBe("az"));
  it("defaults to az with no header", () => expect(localeFromAcceptLanguage(null)).toBe("az"));
});
