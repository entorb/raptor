import { describe, expect, it } from "vitest"
import { ENEMY_LIB, MAPS, TILE_CELLS } from "../data/ep1"
import { BEGINNER_MAP } from "../data/training"
import { DIFF_NORMAL, DIFF_TRAIN, MAP_SIZE, Obj } from "./consts"
import type { Ship } from "./enemy"
import { initMobj, moveEobj, moveSobj, newMove } from "./move"
import { Buy, Inventory, newPilotObjs } from "./objects"
import { Rng } from "./rng"
import { CHARGE_SHIELD, NO_INPUT, World } from "./world"

describe("MOVEOBJ", () => {
  it("MoveEobj stops exactly on the target and returns leftover speed", () => {
    const m = newMove(0, 0, 7, 3)
    initMobj(m)
    let left = 0
    for (let i = 0; i < 10 && !m.done; i++) left = moveEobj(m, 3)
    expect(m.done).toBe(true)
    expect([m.x, m.y]).toEqual([7, 3])
    expect(left).toBeGreaterThanOrEqual(0)
  })
  it("MoveSobj keeps flying past the target", () => {
    const m = newMove(0, 0, 0, 10)
    initMobj(m)
    moveSobj(m, 15)
    expect(m.y).toBe(15)
    expect(m.done).toBe(true)
  })
})

describe("Rng (Watcom rand)", () => {
  it("is deterministic per seed and 15-bit", () => {
    const a = new Rng(2048)
    const b = new Rng(2048)
    const seq = Array.from({ length: 8 }, () => a.rand())
    expect(seq).toEqual(Array.from({ length: 8 }, () => b.rand()))
    expect(seq.every((v) => v >= 0 && v < 32768)).toBe(true)
    expect(new Rng(1).rand()).toBe(16838) // (1103515245 + 12345) >> 16 & 0x7fff
  })
})

describe("Inventory (OBJECTS.C)", () => {
  const fresh = () => {
    const plr = { score: 0, sweapon: -1 }
    const inv = new Inventory(plr)
    newPilotObjs(inv)
    return { plr, inv }
  }
  it("new pilot: blasters, 75% shield, $10000", () => {
    const { plr, inv } = fresh()
    expect(inv.isEquip(Obj.FORWARD_GUNS)).toBe(true)
    expect(inv.getAmt(Obj.ENERGY)).toBe(75)
    expect(plr.score).toBe(10000)
  })
  it("buy/sell energy, resale is half price", () => {
    const { plr, inv } = fresh()
    expect(inv.buy(Obj.ENERGY)).toBe(Buy.GOTIT)
    expect(inv.getAmt(Obj.ENERGY)).toBe(100)
    expect(plr.score).toBe(0)
    expect(inv.buy(Obj.ENERGY)).toBe(Buy.NOMONEY)
    plr.score = 99999
    expect(inv.buy(Obj.ENERGY)).toBe(Buy.SHIPFULL)
    inv.sell(Obj.ENERGY)
    expect(inv.getAmt(Obj.ENERGY)).toBe(75)
    expect(plr.score).toBe(99999 + 5000)
    inv.sell(Obj.ENERGY)
    inv.sell(Obj.ENERGY)
    expect(inv.getAmt(Obj.ENERGY)).toBe(25)
    expect(inv.canSell(Obj.ENERGY)).toBe(false) // never below 25%
  })
  it("special weapons cycle and the first one becomes active", () => {
    const { plr, inv } = fresh()
    plr.score = 10_000_000
    inv.buy(Obj.AIR_MISSLE)
    expect(plr.sweapon).toBe(Obj.AIR_MISSLE)
    inv.buy(Obj.DUMB_MISSLE)
    inv.getNext()
    expect(plr.sweapon).toBe(Obj.DUMB_MISSLE)
    inv.getNext()
    expect(plr.sweapon).toBe(Obj.AIR_MISSLE)
    inv.loseObj()
    expect(inv.isEquip(Obj.AIR_MISSLE)).toBe(false)
    expect(plr.sweapon).toBe(Obj.DUMB_MISSLE)
  })
  it("extra copies of a weapon are spares that replace a lost one (OBJS_Add/OBJS_Del)", () => {
    const { plr, inv } = fresh()
    plr.score = 10_000_000
    expect(inv.buy(Obj.PLASMA_GUNS)).toBe(Buy.GOTIT)
    expect(inv.buy(Obj.PLASMA_GUNS)).toBe(Buy.GOTIT)
    expect(inv.getTotal(Obj.PLASMA_GUNS)).toBe(2)
    inv.del(Obj.PLASMA_GUNS)
    expect(inv.isEquip(Obj.PLASMA_GUNS)).toBe(true)
    expect(inv.getTotal(Obj.PLASMA_GUNS)).toBe(1)
    expect(inv.canBuy(Obj.FORWARD_GUNS)).toBe(false) // only while none is equipped
    for (let i = 0; i < 5; i++) inv.buy(Obj.SUPER_SHIELD)
    expect(inv.buy(Obj.SUPER_SHIELD)).toBe(Buy.SHIPFULL) // at most 5 phase shields
  })
  it("nova bombs stack to 5 and are used up", () => {
    const { plr, inv } = fresh()
    plr.score = 10_000_000
    for (let i = 0; i < 6; i++) inv.buy(Obj.MEGA_BOMB)
    expect(inv.getAmt(Obj.MEGA_BOMB)).toBe(5)
    inv.use(Obj.MEGA_BOMB, () => true)
    expect(inv.getAmt(Obj.MEGA_BOMB)).toBe(4)
  })
})

describe("episode 1 data", () => {
  it("maps are complete and spawn groups are ordered by row (ENEMY_Think relies on it)", () => {
    expect(MAPS).toHaveLength(9)
    for (const m of MAPS) {
      expect(m.flats).toHaveLength(MAP_SIZE)
      // a group starts after a spawn whose link is -1 or 1; group heads must not go back down
      let lastHead = Number.POSITIVE_INFINITY
      for (let i = 0; i < m.spawns.length; i++) {
        const prev = m.spawns[i - 1]
        if (i > 0 && prev && prev[0] !== -1 && prev[0] !== 1) continue
        const y = (m.spawns[i] as number[])[3] as number
        expect(y).toBeLessThanOrEqual(lastHead)
        lastHead = y
      }
      for (const s of m.spawns) expect(ENEMY_LIB[s[1] as number]).toBeDefined()
    }
  })
  it("enemy records are within the DOS array limits", () => {
    for (const e of ENEMY_LIB) {
      expect(e.numflight).toBeLessThanOrEqual(30)
      expect(e.numguns).toBeLessThanOrEqual(24)
    }
  })
  it("every tile has 16 material cells", () => {
    expect(TILE_CELLS.every((c) => /^[0-3]{16}$/.test(c))).toBe(true)
  })
})

describe("training beginner wave (web)", () => {
  const easy = (spawns: number[][]) => spawns.filter((s) => s[5] === 3)
  it("is short, sparse, shield-only, boss last", () => {
    const sp = BEGINNER_MAP.spawns
    const rows = sp.map((s) => s[3] ?? 0)
    expect(rows).toEqual([...rows].sort((a, b) => b - a))
    expect(ENEMY_LIB[sp[sp.length - 1]?.[1] ?? 0]?.bossflag).toBe(1)
    const bonus = new Set(sp.map((s) => ENEMY_LIB[s[1] ?? 0]?.bonus).filter((b) => b !== -1))
    expect([...bonus]).toEqual([Obj.ENERGY])
    expect(sp.length).toBeLessThan(easy(MAPS[0]?.spawns ?? []).length / 3)
  })
  it("spawns a weaker boss", () => {
    const plr = { score: 0, sweapon: -1 }
    const inv = new Inventory(plr)
    newPilotObjs(inv)
    const w = new World(0, plr, inv, DIFF_TRAIN, BEGINNER_MAP)
    w.god = true
    let boss: Ship | undefined
    for (let f = 0; f < 5000 && !boss && w.step(NO_INPUT); f++)
      boss = w.enemies.ships.find((s) => s.lib.bossflag)
    expect(boss?.hits).toBe(75)
  })
})

describe("shield recharge (web: firing pauses, not resets)", () => {
  it("recharges between short bursts", () => {
    const plr = { score: 0, sweapon: -1 }
    const inv = new Inventory(plr)
    newPilotObjs(inv)
    const w = new World(0, plr, inv, DIFF_NORMAL)
    w.god = true
    const fire = { ...NO_INPUT, fire: true }
    // burst every 10 frames: DOS never recharged this way
    for (let f = 0; f < CHARGE_SHIELD * 3; f++) w.step(f % 10 === 0 ? fire : NO_INPUT)
    expect(inv.getAmt(Obj.ENERGY)).toBeGreaterThan(75)
  })
})
