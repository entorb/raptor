// Port of dosraptor/SOURCE/BONUS.C: pickups dropped by enemies.
import { MAP_LEFT, MAX_SHIELD, Obj, type ObjType, PLAYERHEIGHT, PLAYERWIDTH } from "./consts"
import { OBJ_LIB } from "./objects"
import type { World } from "./world"

const MAX_BONUS = 12
const MAX_MONEY = MAX_BONUS - 3
const BONUS_WIDTH = 16
const BONUS_HEIGHT = 16
const GLOW = 32 // ICNGLW_BLK size

/** OBJS_Init numframes of each bonus picture (animation length). */
const FRAMES: Partial<Record<ObjType, number>> = {
  [Obj.PLASMA_GUNS]: 2,
  [Obj.MICRO_MISSLE]: 2,
  [Obj.MINI_GUN]: 4,
  [Obj.TURRET]: 4,
  [Obj.ENERGY_GRAB]: 4,
  [Obj.PULSE_CANNON]: 2,
  [Obj.FORWARD_LASER]: 4,
  [Obj.DEATH_RAY]: 4,
  [Obj.ENERGY]: 4,
  [Obj.ITEMBUY6]: 4,
}

const XPOS = [-1, 0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2, -3, -3, -3, -2]
const YPOS = [-3, -3, -3, -2, -1, 0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2]

export interface Bonus {
  id: number
  type: ObjType
  curframe: number
  x: number
  y: number
  /** top-left of the 16x16 icon (bx/by in DOS) */
  bx: number
  by: number
  gy: number
  pos: number
  /** picked-up money: shows a credits crystal for `countdown` frames */
  dflag: boolean
  countdown: number
}

export class Bonuses {
  list: Bonus[] = []
  energy_count = 0
  gcnt = 0
}

/** BONUS_Add */
export function bonusAdd(w: World, type: ObjType, x: number, y: number): void {
  const b = w.bonus
  if (type >= Obj.LAST_OBJECT || type < 0) return
  if (type === Obj.ITEMBUY6 && b.energy_count > MAX_MONEY) return
  if (b.list.length >= MAX_BONUS) return
  if (type === Obj.ITEMBUY6) b.energy_count++
  b.list.push({
    id: w.newId(),
    type,
    curframe: 0,
    x: x + MAP_LEFT,
    y,
    bx: 0,
    by: 0,
    gy: 0,
    pos: w.rng.random(16),
    dflag: false,
    countdown: 0,
  })
}

function remove(w: World, i: number): void {
  const b = w.bonus
  if (b.list[i]?.type === Obj.ITEMBUY6) b.energy_count--
  b.list.splice(i, 1)
}

/** Player touches a pickup: collect it. Returns true when the bonus is used up. */
function collect(w: World, cur: Bonus): boolean {
  w.sfx("BONUS")
  if (cur.type === Obj.ENERGY) w.inv.addEnergy(MAX_SHIELD / 4)
  else w.inv.add(cur.type)
  w.pickups.push({ type: cur.type, x: cur.x, y: cur.y })
  if (!OBJ_LIB[cur.type]?.moneyflag) return true
  cur.dflag = true
  cur.countdown = 50
  return false
}

/** BONUS_Think */
export function bonusThink(w: World): void {
  const b = w.bonus
  for (let i = 0; i < b.list.length; i++) {
    const cur = b.list[i] as Bonus
    if (stepBonus(w, cur)) remove(w, i--)
  }
  b.gcnt++
}

/** BONUS_Think: per-pickup update; returns true once the pickup should be removed. */
function stepBonus(w: World, cur: Bonus): boolean {
  const b = w.bonus
  cur.bx = cur.x - BONUS_WIDTH / 2 + (XPOS[cur.pos] as number)
  cur.by = cur.y - BONUS_HEIGHT / 2 + (YPOS[cur.pos] as number)
  cur.gy = cur.y - (GLOW >> 1) + (YPOS[cur.pos] as number)
  cur.y++
  if (b.gcnt & 1) {
    cur.pos++
    if (cur.pos >= 16) cur.pos = 0
    cur.curframe++
    if (cur.curframe >= (FRAMES[cur.type] ?? 1)) cur.curframe = 0
  }
  const x2 = w.playerx + PLAYERWIDTH
  const y2 = w.playery + PLAYERHEIGHT
  const touched = cur.x > w.playerx && cur.x < x2 && cur.y > w.playery && cur.y < y2
  if (touched && !cur.dflag && w.inv.getAmt(Obj.ENERGY) > 0 && collect(w, cur)) return true
  if (cur.dflag) {
    cur.countdown--
    if (cur.countdown <= 0) return true
  }
  return cur.gy > 200
}
