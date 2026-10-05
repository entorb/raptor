import { expect, it } from "vitest"
import { TRAIN_WAVES } from "../campaign"
import { MAPS } from "../data/ep1"
import { briefingUnits } from "./briefing"

it("briefing shows a boss and 4 intel units, different for every wave of a sector", () => {
  for (const [sector, waves] of [
    ["bravo", MAPS.length],
    ["train", TRAIN_WAVES],
  ] as const) {
    const seen = new Set<string>()
    for (let w = 0; w < waves; w++) {
      const { boss, intel } = briefingUnits(sector, w)
      expect(boss, `${sector} ${w}`).toBeTruthy()
      expect(intel).toHaveLength(4)
      const key = [boss, ...intel].join()
      expect(seen.has(key), `${sector} ${w}: ${key}`).toBe(false)
      seen.add(key)
    }
  }
})
