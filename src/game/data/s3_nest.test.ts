import { describe, expect, it } from "vitest"
import { DIFF_HARD, MAP_COLS, MAP_SIZE, MAX_ONSCREEN } from "../sim/consts"
import { EXP_ENERGY, F_GROUND, F_KAMI, F_LINEAR, F_REPEAT } from "../sim/enemy"
import { Inventory, newPilotObjs } from "../sim/objects"
import { NO_INPUT, World } from "../sim/world"
import { NEST_LIB, NEST_WAVES, nestMap } from "./s3_nest"

const waves = Array.from({ length: NEST_WAVES }, (_, w) => nestMap(w))

describe("Bugger Nest data (web)", () => {
  it("has 9 waves with DOS-sized maps and tile tables", () => {
    expect(waves).toHaveLength(9)
    for (const m of waves) {
      expect(m?.flats).toHaveLength(MAP_SIZE)
      expect(m?.tiles?.cells.every((c) => /^[0-3]{16}$/.test(c))).toBe(true)
      expect(m?.tiles?.link.every((l) => l >= 0 && l < (m?.tiles?.cells.length ?? 0))).toBe(true)
      const structs = m?.tiles?.link.filter((l, i) => l !== i).length ?? 0
      expect(structs).toBeGreaterThanOrEqual(50)
    }
  })

  it("library records stay within the DOS limits; flown paths end off screen", () => {
    for (const e of NEST_LIB) {
      expect(e.numflight).toBeLessThanOrEqual(30)
      expect(e.numguns).toBeLessThanOrEqual(24)
      if (e.flighttype !== F_LINEAR) continue
      const x = e.flightx[e.numflight - 1] ?? 0
      const y = 100 - e.h / 2 + (e.flighty[e.numflight - 1] ?? 0)
      expect(y >= 200 || Math.abs(x) >= 264, e.iname).toBe(true)
    }
  })

  it("spawns are sorted by row, packs share a row, the boss comes last", () => {
    for (const [w, m] of waves.entries()) {
      const sp = m?.spawns ?? []
      expect(sp.length, `wave ${w}`).toBeGreaterThan(220)
      expect(sp.length, `wave ${w}`).toBeLessThan(420)
      const rows = sp.map((s) => s[3] ?? 0)
      expect(rows).toEqual([...rows].sort((a, b) => b - a))
      sp.forEach((s, i) => {
        expect(NEST_LIB[s[1] ?? -1]).toBeDefined()
        expect([3, 4, 5]).toContain(s[5])
        if (s[0] === 0) expect(sp[i + 1]?.[3]).toBe(s[3])
      })
      const last = sp[sp.length - 1] ?? []
      expect(NEST_LIB[last[1] ?? 0]?.bossflag).toBe(1)
      expect(last[5]).toBe(3)
      // Bravo-like loot: 2..5 bonus carriers and a share of crystal droppers per wave
      const libs = sp.map((s) => NEST_LIB[s[1] ?? 0])
      const bonus = libs.filter((e) => (e?.bonus ?? -1) >= 0).length
      expect(bonus, `wave ${w}`).toBeGreaterThanOrEqual(2)
      expect(bonus, `wave ${w}`).toBeLessThanOrEqual(5)
      const crystals = libs.filter((e) => e?.exptype === EXP_ENERGY).length
      expect(crystals, `wave ${w}`).toBeGreaterThanOrEqual(20)
      expect(crystals, `wave ${w}`).toBeLessThanOrEqual(110)
    }
  })

  it("difficulty adds spawns like Bravo: ~45% every level, ground and drops mostly for all", () => {
    const at = (sp: number[][], lv: number) => sp.filter((s) => s[5] === lv)
    const rookieHp = waves.map((m) =>
      at(m?.spawns ?? [], 3).reduce((a, s) => {
        const e = NEST_LIB[s[1] ?? 0]
        return a + (e?.bossflag ? 0 : (e?.hits ?? 0))
      }, 0),
    )
    let ground = 0
    let groundAll = 0
    for (const [w, m] of waves.entries()) {
      const sp = m?.spawns ?? []
      const share = at(sp, 3).length / sp.length
      expect(share, `wave ${w}`).toBeGreaterThan(0.35)
      expect(share, `wave ${w}`).toBeLessThan(0.55)
      for (const lv of [4, 5]) expect(at(sp, lv).length / sp.length).toBeGreaterThan(0.18)
      const drops = at(sp, 3).filter((s) => (NEST_LIB[s[1] ?? 0]?.bonus ?? -1) >= 0)
      expect(drops.length, `wave ${w}: a drop on Rookie`).toBeGreaterThan(0)
      for (const s of sp)
        if (NEST_LIB[s[1] ?? 0]?.flighttype === F_GROUND && !NEST_LIB[s[1] ?? 0]?.bossflag) {
          ground++
          if (s[5] === 3) groundAll++
        }
    }
    expect(groundAll / ground).toBeGreaterThan(0.5)
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
    expect(sum(rookieHp.slice(6))).toBeGreaterThan(1.5 * sum(rookieHp.slice(0, 3)))
  })

  it("ground units stand on solid hive tiles", () => {
    for (const m of waves)
      for (const s of m?.spawns ?? []) {
        const e = NEST_LIB[s[1] ?? 0]
        if (e?.flighttype !== F_GROUND) continue
        const spot = (s[3] ?? 0) * MAP_COLS + (s[2] ?? 0)
        expect(m?.tiles?.cells[spot]).not.toContain("0")
      }
  })

  it("every wave flies to its boss without overflowing MAX_ONSCREEN", () => {
    for (const [w, m] of waves.entries()) {
      const plr = { score: 0, sweapon: -1 }
      const inv = new Inventory(plr)
      newPilotObjs(inv)
      const world = new World(w, plr, inv, DIFF_HARD, m)
      world.god = true
      let peak = 0
      let boss = false
      for (let f = 0; f < 8000 && !boss && world.step(NO_INPUT); f++) {
        peak = Math.max(peak, world.enemies.ships.length)
        boss = world.enemies.ships.some((s) => s.lib.bossflag)
      }
      expect(boss, `wave ${w}`).toBe(true)
      expect(peak, `wave ${w}`).toBeLessThan(MAX_ONSCREEN)
    }
  })

  it("kamikaze and boss records use their flight types", () => {
    expect(NEST_LIB.some((e) => e.flighttype === F_KAMI)).toBe(true)
    expect(
      NEST_LIB.filter((e) => e.bossflag).every((e) => [F_REPEAT, F_GROUND].includes(e.flighttype)),
    ).toBe(true)
  })
})
