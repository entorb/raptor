import { describe, expect, it } from "vitest"
import { DEMOS } from "../data/ep1"
import { DIFF_HARD, Obj } from "./consts"
import { Inventory } from "./objects"
import { type DemoFrame, NO_INPUT, World } from "./world"

/** DEMO_MakePlayer(game 0): the attract-mode loadout. */
function demoWorld(n: number): World {
  const rec = DEMOS[n] as number[][]
  const frames: DemoFrame[] = rec.map((r) => ({
    b: [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0, r[3] ?? 0],
    px: r[4] ?? 0,
    py: r[5] ?? 0,
    pic: r[6] ?? 0,
  }))
  const plr = { score: 0, sweapon: -1 }
  const inv = new Inventory(plr)
  inv.add(Obj.FORWARD_GUNS)
  for (let i = 0; i < 4; i++) inv.add(Obj.ENERGY)
  inv.add(Obj.DETECT)
  plr.score = 10000
  for (const t of [
    Obj.MICRO_MISSLE,
    Obj.MEGA_BOMB,
    Obj.MINI_GUN,
    Obj.AIR_MISSLE,
    Obj.TURRET,
    Obj.DEATH_RAY,
  ])
    inv.add(t)
  inv.getNext()
  const w = new World(frames[0]?.py ?? 0, plr, inv, DIFF_HARD)
  w.playDemo(frames)
  return w
}

describe("demo playback", () => {
  for (const n of [0, 1, 2]) {
    it(`replays DEMO${n + 1}G1 without crashing`, () => {
      const w = demoWorld(n)
      let frames = 0
      let minShield = 999
      while (w.step(NO_INPUT) && frames < 5000) {
        frames++
        minShield = Math.min(minShield, w.shield)
      }
      console.log(
        `demo ${n + 1}: frames ${frames} score ${w.plr.score} shield ${w.shield} min ${minShield} tilepos ${w.tiles.tilepos}`,
      )
      expect(frames).toBeGreaterThan(100)
      const e = w.enemies
      expect(e.spawned).toBeGreaterThan(0)
      expect(e.killed).toBeGreaterThan(0)
      expect(e.killed).toBeLessThanOrEqual(e.spawned)
      expect(w.tiles.destroyed).toBeLessThanOrEqual(w.tiles.structs)
    })
  }
})
