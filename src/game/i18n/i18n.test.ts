import { expect, it } from "vitest"
import { getLang, setLang, t } from "./i18n"
import { STRINGS, type StringKey } from "./strings"

it("defaults to English, interpolates and switches", () => {
  expect(getLang()).toBe("en")
  expect(t("shop.sold", { name: "X" })).toBe("Sold X")
  setLang("de")
  expect(t("shop.sold", { name: "X" })).toBe("X verkauft")
  setLang("en")
})

it("keeps placeholders identical in both languages", () => {
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
  for (const [key, v] of Object.entries(STRINGS)) expect(ph(v.de), key as StringKey).toBe(ph(v.en))
})
