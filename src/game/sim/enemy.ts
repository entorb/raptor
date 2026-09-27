// Port of dosraptor/SOURCE/ENEMY.C: spawning from the map, flight paths, firing, damage.
import { ENEMY_LIB } from "../data/ep1"
import type { EnemyLib } from "../data/types"
import {
  Anim,
  DIFF_EASY,
  DIFF_TRAIN,
  EMPTY,
  MAP_COLS,
  MAP_LEFT,
  MAX_ONSCREEN,
  Obj,
  type ObjType,
  PLAYERWIDTH,
} from "./consts"
import { eshotShoot } from "./eshot"
import { initMobj, type MoveObj, moveEobj, moveMobj, newMove } from "./move"
import type { World } from "./world"

const NORM_SHOOT = -1
const START_SHOOT = 0

export const F_REPEAT = 0
export const F_LINEAR = 1
export const F_KAMI = 2
export const F_GROUND = 3
export const F_GROUNDLEFT = 4
export const F_GROUNDRIGHT = 5

// GANIM_NORM = 0 is the default branch
const GANIM_SHOOT = 1
const GANIM_MULTI = 2

const KAMI_FLY = 0
const KAMI_CHASE = 1
const KAMI_END = 2

const MULTI_OFF = 0
const MULTI_START = 1
const MULTI_END = 2

// EXP_TYPE
const EXP_AIRSMALL1 = 0
const EXP_AIRMED = 1
const EXP_AIRLARGE = 2
const EXP_GRDSMALL = 3
const EXP_GRDMED = 4
const EXP_GRDLARGE = 5
const EXP_BOSS = 6
const EXP_PERSON = 7
const EXP_ENERGY = 8
const EXP_PLATOON = 9
const EXP_AIRSMALL2 = 10

/** ENEMY.H difficulty bits (CSPRITE.level after ENEMY_LoadSprites). */
export const EB_EASY_LEVEL = 8
export const EB_MED_LEVEL = 16
export const EB_HARD_LEVEL = 32
export const EB_NOT_USED = 64
const LEVEL_BITS = [1, 2, 4, EB_EASY_LEVEL, EB_MED_LEVEL, EB_HARD_LEVEL]

export interface Ship {
  id: number
  slib: number
  lib: EnemyLib
  sx: number
  sy: number
  x: number
  y: number
  x2: number
  y2: number
  width: number
  height: number
  hlx: number
  hly: number
  movepos: number
  shootagain: number
  shootcount: number
  shootflag: number
  hits: number
  groundflag: boolean
  doneflag: boolean
  move: MoveObj
  countdown: number
  curframe: number
  num_frames: number
  anim_on: boolean
  backward: boolean
  kami: number
  frame_rate: number
  shoot_on: boolean
  shoot_disable: boolean
  multi: number
  speed: number
  suckagain: number
  /** set when ENEMY_Remove freed the slot (DOS sets item = ~0) */
  removed: boolean
}

/** A CSPRITE spawn after ENEMY_LoadSprites: level is a difficulty bit or EB_NOT_USED. */
export interface Spawn {
  link: number
  slib: number
  x: number
  y: number
  level: number
}

export class Enemies {
  ships: Ship[] = []
  spawns: Spawn[] = []
  cur = 0
  end_waveflag = false
  boss_sound = false
  onscreen: Ship[] = []
  tiley = 0
  private nextId = 1

  /** ENEMY_LoadSprites + ENEMY_Clear */
  load(spawns: number[][], cur_diff: number): void {
    this.ships = []
    this.onscreen = []
    this.end_waveflag = false
    this.boss_sound = false
    this.cur = 0
    this.spawns = spawns.map(([link, slib, x, y, _game, level]) => {
      const lib = ENEMY_LIB[slib ?? 0]
      let bit = LEVEL_BITS[level ?? -1] ?? EB_NOT_USED
      if (!(bit & cur_diff) || !lib?.w) bit = EB_NOT_USED
      return { link: link ?? 0, slib: slib ?? 0, x: x ?? 0, y: y ?? 0, level: bit }
    })
  }

  newId(): number {
    return this.nextId++
  }
}

function remove(w: World, i: number): void {
  const e = w.enemies
  const sh = e.ships[i] as Ship
  sh.removed = true
  e.ships.splice(i, 1)
  if (e.end_waveflag && e.ships.length < 1) w.startendwave = 60
}

function add(w: World, sp: Spawn): void {
  const e = w.enemies
  if (e.ships.length >= MAX_ONSCREEN) return // DOS: EXIT_Error("Max Sprites")
  const lib = ENEMY_LIB[sp.slib] as EnemyLib
  const t = w.tiles
  const n: Ship = {
    id: e.newId(),
    slib: sp.slib,
    lib,
    sx: 0,
    sy: 0,
    x: sp.x * 32 + MAP_LEFT,
    y: t.tileyoff - (e.tiley - sp.y) * 32 - 97,
    x2: 0,
    y2: 0,
    width: lib.w,
    height: lib.h,
    hlx: lib.w >> 1,
    hly: lib.h >> 1,
    movepos: 0,
    shootagain: NORM_SHOOT,
    shootcount: lib.shootcnt,
    shootflag: lib.shootstart,
    hits: lib.hits,
    groundflag: false,
    doneflag: false,
    move: newMove(),
    countdown: 0,
    curframe: 0,
    num_frames: 0,
    anim_on: false,
    backward: false,
    kami: KAMI_FLY,
    frame_rate: lib.frame_rate,
    shoot_on: false,
    shoot_disable: false,
    multi: MULTI_OFF,
    speed: lib.movespeed,
    suckagain: 0,
    removed: false,
  }
  n.x += 16 - n.hlx
  n.y += 16 - n.hly
  n.x2 = n.x + n.width
  n.y2 = n.y + n.height
  n.move.x = n.sx = n.x
  n.move.y = n.sy = n.y
  n.countdown = lib.countdown + -n.move.y

  if (lib.bossflag && w.curplr_diff <= DIFF_EASY) {
    n.hits = n.hits - (n.hits >> 1)
    n.shootcount = n.shootcount - (n.shootcount >> 2)
  }

  switch (lib.animtype) {
    case GANIM_SHOOT:
      n.anim_on = false
      n.num_frames = lib.num_frames
      break
    case GANIM_MULTI:
      n.anim_on = true
      n.num_frames = lib.rewind
      break
    default:
      n.anim_on = true
      n.num_frames = lib.num_frames
      break
  }

  switch (lib.flighttype) {
    case F_GROUND:
      n.groundflag = true
      n.move.x2 = n.x
      n.move.y2 = 211
      break
    case F_GROUNDRIGHT:
      n.x -= n.width
      n.move.x = n.sx = n.x
      n.groundflag = true
      n.move.x2 = 335
      n.move.y2 = 211
      break
    case F_GROUNDLEFT:
      n.x += n.width
      n.move.x = n.sx = n.x
      n.groundflag = true
      n.move.x2 = -n.hlx
      n.move.y2 = 211
      break
    default: // F_REPEAT, F_LINEAR, F_KAMI
      n.groundflag = false
      n.sy = 100 - n.hly
      n.move.x2 = n.sx + (lib.flightx[0] ?? 0)
      n.move.y2 = n.sy + (lib.flighty[0] ?? 0)
      n.movepos = 1
      initMobj(n.move)
      moveMobj(n.move)
      break
  }

  n.suckagain = lib.hits >> 4
  if (lib.song !== EMPTY) e.boss_sound = true
  e.ships.push(n)
}

/** ENEMY_GetRandom */
export function enemyGetRandom(w: World): Ship | null {
  const v = w.enemies.onscreen
  if (!v.length) return null
  return v[w.rng.random(v.length)] ?? null
}

/** ENEMY_GetRandomAir */
export function enemyGetRandomAir(w: World): Ship | null {
  const v = w.enemies.onscreen
  if (!v.length) return null
  const air = v.filter((s) => !s.groundflag)
  if (!air.length) return null
  return air[w.rng.random(air.length)] ?? null
}

type Filter = "all" | "ground" | "air"

function inside(s: Ship, x: number, y: number): boolean {
  return x > s.x && x < s.x2 && y > s.y && y < s.y2
}

/** ENEMY_DamageAll / ENEMY_DamageGround / ENEMY_DamageAir */
export function enemyDamage(w: World, f: Filter, x: number, y: number, damage: number): boolean {
  for (const s of w.enemies.onscreen) {
    if (f === "ground" && !s.groundflag) continue
    if (f === "air" && s.groundflag) continue
    if (inside(s, x, y)) {
      s.hits -= damage
      if (f !== "all" && w.curplr_diff === DIFF_TRAIN) s.hits -= damage
      return true
    }
  }
  return false
}

/** ENEMY_DamageEnergy (energy grab) */
export function enemyDamageEnergy(w: World, x: number, y: number, damage: number): Ship | null {
  for (const s of w.enemies.onscreen) {
    if (s.groundflag) continue
    if (inside(s, x, y)) {
      s.hits--
      if (s.lib.suck) {
        if (s.suckagain > 0) s.suckagain -= damage
        else {
          s.shoot_on = false
          s.shoot_disable = true
          s.shootagain = NORM_SHOOT
          w.sfx3d("EGRAB", s.x + s.hlx)
        }
      }
      return s
    }
  }
  return null
}

/** Next path point, then continue with the leftover speed (shared by REPEAT/LINEAR/KAMI). */
function retarget(s: Ship, x2: number, y2: number, speed: number): void {
  s.move.x = s.move.x2
  s.move.y = s.move.y2
  s.move.x2 = x2
  s.move.y2 = y2
  initMobj(s.move)
  moveMobj(s.move)
  moveEobj(s.move, speed)
}

function setPos(s: Ship): void {
  s.x = s.move.x
  s.y = s.move.y
  s.x2 = s.x + s.width - 1
  s.y2 = s.y + s.height - 1
}

/** ENEMY_Think */
export function enemyThink(w: World): void {
  const e = w.enemies
  const t = w.tiles
  if (e.boss_sound) w.bossLoop = true

  e.tiley = Math.trunc(t.tilepos / MAP_COLS) - 3

  if (!e.end_waveflag) {
    while (e.cur < e.spawns.length && (e.spawns[e.cur] as Spawn).y === e.tiley) {
      for (;;) {
        const old = e.spawns[e.cur] as Spawn
        if (old.level !== EB_NOT_USED) add(w, old)
        if (e.cur === e.spawns.length - 1) {
          e.end_waveflag = true
          break
        }
        e.cur++
        if (old.link === EMPTY || old.link === 1) break
      }
      if (e.end_waveflag) break
    }
  }

  e.onscreen = []

  for (let i = 0; i < e.ships.length; i++) {
    const s = e.ships[i] as Ship
    const lib = s.lib

    if (lib.num_frames > 1) {
      if (s.frame_rate < 1) {
        s.frame_rate = lib.frame_rate
        if (s.anim_on) {
          s.curframe++
          if (s.curframe >= s.num_frames) {
            s.curframe -= lib.rewind
            if (lib.animtype === GANIM_SHOOT) {
              s.anim_on = false
              s.shoot_on = true
            } else if (lib.animtype === GANIM_MULTI) {
              if (s.multi === MULTI_START) {
                s.num_frames = lib.num_frames
                s.multi = MULTI_END
              } else if (s.multi === MULTI_END) s.shoot_on = true
            }
          }
        }
      } else s.frame_rate--

      if (s.countdown < 1) {
        if (lib.animtype === GANIM_SHOOT) s.anim_on = true
        else if (lib.animtype === GANIM_MULTI) {
          if (s.multi === MULTI_OFF) s.multi = MULTI_START
        } else s.shoot_on = true
      } else s.countdown -= lib.movespeed
    } else if (s.countdown < 1) {
      s.countdown = -1
      s.shoot_on = true
    } else s.countdown -= lib.movespeed

    switch (lib.flighttype) {
      case F_REPEAT: {
        setPos(s)
        const speed = moveEobj(s.move, lib.movespeed)
        if (s.move.done) {
          retarget(
            s,
            s.sx + (lib.flightx[s.movepos] ?? 0),
            s.sy + (lib.flighty[s.movepos] ?? 0),
            speed,
          )
          if (!s.backward) {
            s.movepos++
            if (s.movepos >= lib.numflight) {
              s.backward = true
              s.movepos = lib.numflight - 1
            }
          } else {
            s.movepos--
            if (s.movepos <= lib.repos) {
              s.backward = false
              s.movepos = lib.repos
            }
          }
        }
        break
      }
      case F_KAMI: {
        setPos(s)
        const speed = moveEobj(s.move, lib.movespeed)
        if (s.kami === KAMI_END) {
          if (s.move.y > 201) s.doneflag = true
          if (s.move.x > 320 + s.hlx) s.doneflag = true
          if (s.move.y + s.width < 0) s.doneflag = true
          if (s.move.x + s.width < 0) s.doneflag = true
        }
        if (s.move.done && s.kami !== KAMI_END) {
          s.x2 = s.x + s.width - 1
          s.y2 = s.y + s.height - 1
          if (s.kami === KAMI_CHASE) {
            retarget(s, w.player_cx, w.player_cy, speed)
            s.kami = KAMI_END
          } else {
            retarget(
              s,
              s.sx + (lib.flightx[s.movepos] ?? 0),
              s.sy + (lib.flighty[s.movepos] ?? 0),
              speed,
            )
          }
          if (s.movepos < lib.numflight - 1) s.movepos++
          else if (s.kami === KAMI_FLY) s.kami = KAMI_CHASE
        }
        break
      }
      case F_LINEAR: {
        setPos(s)
        const speed = moveEobj(s.move, lib.movespeed)
        if (s.move.done) {
          retarget(
            s,
            s.sx + (lib.flightx[s.movepos] ?? 0),
            s.sy + (lib.flighty[s.movepos] ?? 0),
            speed,
          )
          s.movepos++
          if (s.movepos > lib.numflight) s.doneflag = true
        }
        break
      }
      case F_GROUND:
        if (t.scroll_flag) s.y++
        if (s.y > s.move.y2) s.doneflag = true
        s.x2 = s.x + s.width - 1
        s.y2 = s.y + s.height - 1
        break
      case F_GROUNDRIGHT:
        if (t.scroll_flag) s.y++
        if (s.y >= 0) {
          s.x += lib.movespeed
          if (s.x > s.move.x2) s.doneflag = true
          else if (s.y > s.move.y2) s.doneflag = true
        }
        s.x2 = s.x + s.width - 1
        s.y2 = s.y + s.height - 1
        break
      case F_GROUNDLEFT:
        if (t.scroll_flag) s.y++
        if (s.y >= 0) {
          s.x -= lib.movespeed
          if (s.x < s.move.x2) s.doneflag = true
          else if (s.y > s.move.y2) s.doneflag = true
        }
        s.x2 = s.x + s.width - 1
        s.y2 = s.y + s.height - 1
        break
    }

    if (s.shoot_on) {
      switch (s.shootagain) {
        case NORM_SHOOT:
          s.shootflag--
          if (s.shootflag >= 0) break
          s.shootflag = lib.shotspace
          if (!s.shoot_disable) for (let g = 0; g < lib.numguns; g++) eshotShoot(w, s, g)
          s.shootcount--
          if (s.shootcount < 1) s.shootagain = lib.shootframe
          break
        case START_SHOOT:
          s.shootagain = NORM_SHOOT
          s.shootcount = lib.shootcnt
          s.shootflag = lib.shotspace
          break
        default:
          s.shootagain--
          break
      }
    }

    if (s.doneflag) {
      remove(w, i--)
      continue
    }

    if (lib.bossflag && s.hits < 50 && w.gl_cnt & 2) {
      const x = s.x + w.rng.random(s.width)
      const y = s.y + w.rng.random(s.height)
      w.startAnim(Anim.SMALL_AIR_EXPLO, x, y)
    }

    if (!s.groundflag) {
      if (w.player_cx > s.x && w.player_cx < s.x2 && w.player_cy > s.y && w.player_cy < s.y2) {
        s.hits -= PLAYERWIDTH / 2
        const suben = s.width > s.height ? s.width : s.height
        w.subEnergy(suben >> 2)
        const x = w.player_cx + (w.rng.random(8) - 4)
        const y = w.player_cy + (w.rng.random(8) - 4)
        w.startAnim(Anim.SMALL_AIR_EXPLO, x, y)
        w.sfx("CRASH")
      }
    }

    if (s.hits <= 0) {
      w.plr.score += lib.money
      w.sfx3d("AIREXPLO", s.x + s.hlx)
      explodeShip(w, s)
      if (lib.bonus !== EMPTY) w.bonusAdd(lib.bonus as ObjType, s.x, s.y)
      w.kills.push({
        id: s.id,
        x: s.x + s.hlx,
        y: s.y + s.hly,
        w: s.width,
        h: s.height,
        ground: s.groundflag,
      })
      remove(w, i--)
      continue
    }

    const y = s.y + s.height
    if (y > 0 && s.y < 200) {
      const x = s.x + s.width
      if (x > 0 && s.x < 320) e.onscreen.push(s)
    }
  }
}

function explodeShip(w: World, s: Ship): void {
  const cx = s.x + s.hlx
  const cy = s.y + s.hly
  const r = w.rng
  const area = (s.width >> 4) * (s.height >> 4)
  switch (s.lib.exptype) {
    case EXP_ENERGY:
      w.startAnim(Anim.ENERGY_AIR_EXPLO, cx, cy)
      w.bonusAdd(Obj.ITEMBUY6, s.x, s.y)
      break
    case EXP_AIRSMALL1:
      w.startAnim(Anim.MED_AIR_EXPLO, cx, cy)
      break
    case EXP_AIRSMALL2:
      w.startAnim(Anim.MED_AIR_EXPLO2, cx, cy)
      break
    case EXP_AIRMED:
      w.startAnim(Anim.LARGE_AIR_EXPLO, cx, cy)
      break
    case EXP_AIRLARGE:
      w.startAnim(Anim.LARGE_AIR_EXPLO, cx, cy)
      for (let loop = 0; loop < area; loop++) {
        const x = s.x + r.random(s.width)
        const y = s.y + r.random(s.height)
        if (loop & 1) w.startAnim(Anim.MED_AIR_EXPLO, x, y)
        else w.startAAnim(Anim.MED_AIR_EXPLO2, x, y)
      }
      break
    case EXP_GRDSMALL:
      w.startAnim(Anim.SMALL_GROUND_EXPLO, cx, cy)
      break
    case EXP_GRDMED: {
      const x = s.x + r.random(s.width)
      const y = s.y + r.random(s.height)
      w.startAnim(r.random(2) === 0 ? Anim.GROUND_SPARKLE : Anim.GROUND_FLARE, x, y)
      w.startAnim(Anim.LARGE_GROUND_EXPLO1, cx, cy)
      break
    }
    case EXP_GRDLARGE:
      w.startAnim(Anim.LARGE_GROUND_EXPLO1, cx, cy)
      for (let loop = 0; loop < area; loop++) {
        const x = s.x + r.random(s.width)
        const y = s.y + r.random(s.height)
        w.startAnim(r.random(2) === 0 ? Anim.GROUND_FLARE : Anim.GROUND_SPARKLE, x, y)
        w.startAnim(Anim.SMALL_GROUND_EXPLO, x, y)
      }
      break
    case EXP_BOSS:
      w.startAnim(Anim.LARGE_AIR_EXPLO, cx, cy)
      for (let loop = 0; loop < area; loop++) {
        const x = s.x + r.random(s.width)
        const y = s.y + r.random(s.height)
        w.startAAnim(Anim.GROUND_FLARE, x, y)
        if (loop & 1) w.startAnim(Anim.LARGE_AIR_EXPLO, x, y)
        else w.startAnim(Anim.MED_AIR_EXPLO2, x, y)
      }
      break
    case EXP_PERSON:
      w.startAnim(Anim.PERSON, cx, cy)
      break
    case EXP_PLATOON:
      w.startAnim(Anim.PLATOON, cx, cy)
      break
  }
}

/** ENEMY_GetBaseDamage: average remaining boss hit points in percent (damage scanner). */
export function enemyBaseDamage(w: World): number {
  let total = 0
  let nums = 0
  for (const s of w.enemies.ships) {
    if (!s.lib.bossflag) continue
    if (s.y + s.hly < 0) continue
    total += Math.trunc((s.hits * 100) / s.lib.hits)
    nums++
  }
  return nums ? Math.trunc(total / nums) : 0
}
