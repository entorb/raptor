// Port of dosraptor/SOURCE/OBJECTS.C: player inventory, shop rules, shield energy.

import { EMPTY, type Fx, MAX_SHIELD, Obj, type ObjType } from "./consts"

export interface ObjLib {
  name: string
  cost: number
  start_cnt: number
  max_cnt: number
  /** true when OBJS_Use fires it through SHOTS_PlayerShoot (actf) */
  shoot: boolean
  forever: boolean
  onlyflag: boolean
  loseit: boolean
  specialw: boolean
  moneyflag: boolean
  /** available in the shareware episode (game1flag) */
  game1flag: boolean
  fx: Fx | null
}

function lib(
  name: string,
  cost: number,
  o: Partial<ObjLib> & Pick<ObjLib, "forever" | "loseit" | "specialw">,
): ObjLib {
  return {
    name,
    cost,
    start_cnt: 1,
    max_cnt: 1,
    shoot: true,
    onlyflag: false,
    moneyflag: false,
    game1flag: true,
    fx: null,
    ...o,
  }
}

const money = (name: string, cost: number, game1flag = true): ObjLib =>
  lib(name, cost, {
    start_cnt: cost,
    max_cnt: cost,
    shoot: false,
    forever: false,
    loseit: true,
    specialw: false,
    moneyflag: true,
    game1flag,
  })

/** OBJS_Init obj_lib, indexed by Obj. Names are the web shop labels (space re-theme). */
export const OBJ_LIB: ObjLib[] = [
  lib("Twin Blasters", 12000, { forever: true, loseit: false, specialw: false, fx: "GUN" }),
  lib("Plasma Cannon", 78800, { forever: true, loseit: true, specialw: false, fx: "GUN" }),
  lib("Micro Missiles", 175600, { forever: true, loseit: true, specialw: false, fx: "GUN" }),
  lib("Dumb-Fire Missiles", 145200, { forever: true, loseit: true, specialw: true, fx: "MISSLE" }),
  lib("Auto-Track Minigun", 250650, { forever: true, loseit: true, specialw: true, fx: "GUN" }),
  lib("Laser Turret", 512850, {
    forever: true,
    loseit: true,
    specialw: true,
    fx: "LASER",
    game1flag: false,
  }),
  lib("Missile Pods", 204950, { forever: true, loseit: true, specialw: true, fx: "GUN" }),
  lib("Air-to-Air Missiles", 63500, { forever: true, loseit: true, specialw: true, fx: "MISSLE" }),
  lib("Surface Missiles", 110000, { forever: true, loseit: true, specialw: true, fx: "MISSLE" }),
  lib("Hull Buster Bomb", 98200, {
    forever: true,
    loseit: true,
    specialw: true,
    fx: "MISSLE",
    game1flag: false,
  }),
  lib("Energy Siphon", 300750, {
    forever: true,
    loseit: true,
    specialw: true,
    fx: "GUN",
    game1flag: false,
  }),
  lib("Nova Bomb", 32250, {
    max_cnt: 5,
    forever: false,
    onlyflag: true,
    loseit: true,
    specialw: false,
    fx: "GUN",
  }),
  lib("Pulse Cannon", 725000, { forever: true, loseit: true, specialw: true, fx: "GUN" }),
  lib("Twin Lasers", 1750000, {
    forever: true,
    loseit: true,
    specialw: true,
    fx: "LASER",
    game1flag: false,
  }),
  lib("Death Ray", 950000, {
    forever: true,
    loseit: true,
    specialw: true,
    fx: "LASER",
    game1flag: false,
  }),
  lib("Phase Shield", 78500, {
    start_cnt: MAX_SHIELD,
    max_cnt: MAX_SHIELD,
    shoot: false,
    forever: false,
    loseit: false,
    specialw: false,
  }),
  lib("Shield Energy", 400, {
    start_cnt: MAX_SHIELD / 4,
    max_cnt: MAX_SHIELD,
    shoot: false,
    forever: true,
    onlyflag: true,
    loseit: false,
    specialw: false,
  }),
  lib("Damage Scanner", 10000, {
    shoot: false,
    forever: false,
    onlyflag: true,
    loseit: false,
    specialw: false,
  }),
  money("Credit Cache 1", 93800),
  money("Credit Cache 2", 76000),
  money("Credit Cache 3", 55700),
  money("Credit Cache 4", 35200),
  money("Credit Cache 5", 122500),
  money("Energy Crystal", 50),
]

/**
 * Special weapons in shop order (by price). Web change to RAP.C Do_Game: the shop rows, HUD
 * strip, number-key picks (`gameInput.ts SPECIAL_KEYS`) and the cycle (Shift/Alt) keys all walk
 * this same order instead of the DOS object order.
 */
export const WEAPON_ORDER: ObjType[] = OBJ_LIB.map((_, t) => t as ObjType)
  .filter((t) => OBJ_LIB[t]?.specialw)
  .sort((a, b) => (OBJ_LIB[a]?.cost ?? 0) - (OBJ_LIB[b]?.cost ?? 0))

export interface InvObj {
  type: ObjType
  num: number
  inuse: boolean
}

/** OBJECTS.H BUYSTUFF */
export const Buy = { GOTIT: 0, NOMONEY: 1, SHIPFULL: 2, ERROR: 3 } as const
export type Buy = (typeof Buy)[keyof typeof Buy]

export const MAX_OBJS = 20
/** Phase shields on board (web: separate objects, max 5) */
export const MAX_PHASE = 5

/**
 * Inventory with the DOS semantics: `objs` keeps insertion order (link list), `p_objs` are the
 * equipped ones. `reg` = all weapons purchasable (the registered-version flag).
 */
export class Inventory {
  objs: InvObj[] = []
  p_objs: (InvObj | null)[] = new Array(Obj.LAST_OBJECT).fill(null)
  /** Set to EMPTY by OBJS_Add (RAP.C g_oldsuper/g_oldshield). */
  onAdd: () => void = () => {}

  constructor(
    public plr: { score: number; sweapon: number },
    public reg = true,
  ) {}

  load(list: InvObj[]): void {
    this.objs = []
    this.p_objs.fill(null)
    for (const o of list) {
      if (this.objs.length >= MAX_OBJS) break
      const cur = { ...o }
      this.objs.push(cur)
      if (cur.inuse) this.p_objs[cur.type] = cur
    }
  }

  save(): InvObj[] {
    return this.objs.map((o) => ({ ...o }))
  }

  private remove(o: InvObj): void {
    const i = this.objs.indexOf(o)
    if (i >= 0) this.objs.splice(i, 1)
  }

  private equip(type: ObjType): boolean {
    for (const cur of this.objs) {
      if (cur.type === type && this.p_objs[type] === null) {
        cur.inuse = true
        this.p_objs[type] = cur
        return true
      }
    }
    return false
  }

  add(type: ObjType): Buy {
    if (type >= Obj.LAST_OBJECT) return Buy.ERROR
    this.onAdd()
    const lib = OBJ_LIB[type]
    if (!lib) return Buy.ERROR
    if (lib.moneyflag) {
      this.plr.score += lib.cost
      return Buy.GOTIT
    }
    if (!this.reg && !lib.game1flag) return Buy.GOTIT
    const stack = lib.onlyflag ? this.objs.find((o) => o.type === type) : undefined
    if (stack) {
      if (stack.num >= lib.max_cnt) return Buy.SHIPFULL
      stack.num = Math.min(stack.num + lib.start_cnt, lib.max_cnt)
      return Buy.GOTIT
    }
    if (this.objs.length >= MAX_OBJS) return Buy.SHIPFULL
    const cur: InvObj = { type, num: lib.start_cnt, inuse: false }
    this.objs.push(cur)
    if (this.p_objs[type] === null) {
      cur.inuse = true
      this.p_objs[type] = cur
      if (this.plr.sweapon === EMPTY && lib.specialw) this.plr.sweapon = type
    }
    return Buy.GOTIT
  }

  del(type: ObjType): void {
    const cur = this.p_objs[type]
    if (!cur) return
    this.remove(cur)
    this.p_objs[type] = null
    this.equip(type)
    if (type === this.plr.sweapon) this.getNext()
  }

  getNext(dir = 1): void {
    let idx = WEAPON_ORDER.indexOf(this.plr.sweapon as ObjType)
    let setval = EMPTY
    for (const _ of WEAPON_ORDER) {
      idx = (idx + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length
      const pos = WEAPON_ORDER[idx] as ObjType
      const cur = this.p_objs[pos]
      if (cur?.num) {
        setval = pos
        break
      }
    }
    this.plr.sweapon = setval
  }

  /** OBJS_Use: `shoot` is SHOTS_PlayerShoot. */
  use(type: ObjType, shoot: (t: ObjType) => boolean): boolean {
    const cur = this.p_objs[type]
    const lib = OBJ_LIB[type]
    if (!cur || !lib) return false
    if (lib.shoot && shoot(type) && !lib.forever) cur.num--
    if (cur.num <= 0 && !lib.forever) {
      this.remove(cur)
      this.p_objs[type] = null
      this.equip(type)
      if (this.plr.sweapon === type) this.getNext()
    }
    return true
  }

  sell(type: ObjType): number {
    const cur = this.p_objs[type]
    const lib = OBJ_LIB[type]
    if (!cur || !lib) return 0
    this.plr.score += this.getResale(type)
    if (type === Obj.DETECT) {
      // DOS only unequips it (and leaks the link); remove it for real
      this.remove(cur)
      this.p_objs[type] = null
      return 0
    }
    if (lib.onlyflag) {
      cur.num -= lib.start_cnt
      if (cur.num <= 0) {
        cur.num = 0
        if (!lib.forever) {
          this.remove(cur)
          this.p_objs[type] = null
          this.equip(type)
          if (this.plr.sweapon === type) this.getNext()
        }
        return 0
      }
      return cur.num
    }
    this.del(type)
    return this.getTotal(type)
  }

  buy(type: ObjType): Buy {
    if (type === Obj.SUPER_SHIELD && this.getTotal(Obj.SUPER_SHIELD) >= MAX_PHASE)
      return Buy.SHIPFULL
    if (this.plr.score < this.getCost(type)) return Buy.NOMONEY
    const r = this.add(type)
    if (r === Buy.GOTIT) this.plr.score -= this.getCost(type)
    return r
  }

  getAmt(type: ObjType): number {
    return this.p_objs[type]?.num ?? 0
  }

  subAmt(type: ObjType, amt: number): number {
    const cur = this.p_objs[type]
    if (!cur) return 0
    cur.num = Math.max(0, cur.num - amt)
    return cur.num
  }

  getTotal(type: ObjType): number {
    return this.objs.filter((o) => o.type === type).length
  }

  getCost(type: ObjType): number {
    const lib = OBJ_LIB[type]
    if (!lib) return 99999999
    return lib.onlyflag ? lib.cost * lib.start_cnt : lib.cost
  }

  getResale(type: ObjType): number {
    if (!this.p_objs[type]) return 0
    return this.getCost(type) >> 1
  }

  isEquip(type: ObjType): boolean {
    return this.p_objs[type] !== null
  }

  canBuy(type: ObjType): boolean {
    const lib = OBJ_LIB[type]
    if (type >= Obj.LAST_OBJECT || !lib) return false
    if (type === Obj.FORWARD_GUNS && this.isEquip(type)) return false
    if (!this.reg && !lib.game1flag) return false
    return this.getCost(type) !== 0
  }

  /** No room for another one: full stack, 5 phase shields or 20 objects on board (add/buy SHIPFULL). */
  full(type: ObjType): boolean {
    const lib = OBJ_LIB[type]
    if (!lib || lib.moneyflag) return false
    if (type === Obj.SUPER_SHIELD && this.getTotal(type) >= MAX_PHASE) return true
    const stack = lib.onlyflag ? this.objs.find((o) => o.type === type) : undefined
    if (stack) return stack.num >= lib.max_cnt
    return this.objs.length >= MAX_OBJS
  }

  canSell(type: ObjType): boolean {
    const cur = this.p_objs[type]
    const lib = OBJ_LIB[type]
    if (type >= Obj.LAST_OBJECT || !cur || !lib) return false
    // web change: the Twin Blasters stay on board (DOS lets you sell your only gun)
    if (type === Obj.FORWARD_GUNS) return false
    if (lib.onlyflag && type === Obj.ENERGY && cur.num <= lib.start_cnt) return false
    return cur.num >= lib.start_cnt
  }

  /** STORE.C MakeBuyItems: buyable items sorted by cost. */
  buyList(): ObjType[] {
    const out: ObjType[] = []
    for (let t = 0; t < Obj.ITEMBUY1; t++) if (this.canBuy(t as ObjType)) out.push(t as ObjType)
    return out.sort((a, b) => this.getCost(a) - this.getCost(b))
  }

  /** STORE.C MakeSellItems: sellable items sorted by cost. */
  sellList(): ObjType[] {
    const out: ObjType[] = []
    for (let t = 0; t < Obj.LAST_OBJECT; t++) if (this.canSell(t as ObjType)) out.push(t as ObjType)
    return out.sort((a, b) => this.getCost(a) - this.getCost(b))
  }

  /** OBJS_MakeSpecial */
  makeSpecial(type: ObjType): boolean {
    if (!this.p_objs[type] || !OBJ_LIB[type]?.specialw) return false
    this.plr.sweapon = type
    return true
  }

  /** OBJS_AddEnergy */
  addEnergy(amt: number): number {
    let cur = this.p_objs[Obj.ENERGY]
    if (!cur) return 0
    const elib = OBJ_LIB[Obj.ENERGY] as ObjLib
    if (cur.num < elib.max_cnt) {
      if (cur.num === 0) return 0
      cur.num = Math.min(cur.num + amt, elib.max_cnt)
    } else {
      cur = this.p_objs[Obj.SUPER_SHIELD]
      if (!cur || cur.num === 0) return 0
      const slib = OBJ_LIB[Obj.SUPER_SHIELD] as ObjLib
      cur.num = Math.min(cur.num + (amt >> 2), slib.max_cnt)
    }
    return cur.num
  }

  /** OBJS_LoseObj: lose the current special weapon, else the last losable item. */
  loseObj(): boolean {
    if (this.plr.sweapon === EMPTY) {
      for (let type = Obj.LAST_OBJECT - 1; type >= 0; type--) {
        if (this.p_objs[type] && OBJ_LIB[type]?.loseit) {
          this.del(type as ObjType)
          break
        }
      }
    } else {
      this.del(this.plr.sweapon as ObjType)
    }
    return true
  }
}

/** New pilot loadout (WINDOWS.C register dialog). */
export function newPilotObjs(inv: Inventory): void {
  inv.add(Obj.FORWARD_GUNS)
  inv.add(Obj.ENERGY)
  inv.add(Obj.ENERGY)
  inv.add(Obj.ENERGY)
  inv.plr.score = 10000
  inv.getNext()
}
