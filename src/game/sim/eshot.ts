// Port of dosraptor/SOURCE/ESHOT.C: enemy projectiles.
import { PIC_SIZES } from "../data/ep1"
import { Anim, type Fx, PLAYERHEIGHT, PLAYERWIDTH } from "./consts"
import type { Ship } from "./enemy"
import { initMobj, type MoveObj, moveSobj, newMove } from "./move"
import type { World } from "./world"

const MAX_ESHOT = 80

export const ES_ATPLAYER = 0
export const ES_ATDOWN = 1
export const ES_ANGLELEFT = 2
export const ES_ANGLERIGHT = 3
export const ES_MISSLE = 4
export const ES_LASER = 5
export const ES_MINES = 6
export const ES_PLASMA = 7
export const ES_COCONUTS = 8

export interface EShotLib {
  key: string
  num_frames: number
  smokeflag: boolean
  speed: number
  xoff: number
  yoff: number
  hits: number
}

function elib(
  key: string,
  hits: number,
  num_frames: number,
  speed: number,
  smokeflag = false,
): EShotLib {
  const [w, h] = PIC_SIZES[key] ?? [8, 8]
  return { key, hits, num_frames, speed, smokeflag, xoff: w >> 1, yoff: h >> 1 }
}

/** ESHOT_Init plib */
const LIB_NORMAL = elib("ESHOT_BLK", 2, 2, 6)
const LIB_ATPLAY = elib("ESHOT_BLK", 1, 2, 6)
const LIB_MISSLE = elib("EMISLE_BLK", 4, 2, 10, true)
const LIB_MINES = elib("MINE_BLK", 16, 2, 0)
const LIB_LASER = elib("ELASER_BLK", 12, 4, 6)
const LIB_PLASMA = elib("EPLASMA_PIC", 15, 1, 10)
const LIB_COCO = elib("COCONUT_PIC", 1, 4, 6)

const XPOS = [-1, 0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2, -3, -3, -3, -2]
const YPOS = [-3, -3, -3, -2, -1, 0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2]

export interface EShot {
  id: number
  curframe: number
  x: number
  y: number
  move: MoveObj
  doneflag: boolean
  lib: EShotLib
  cnt: number
  speed: number
  pos: number
  type: number
  en: Ship
  gun_num: number
}

/** ESHOT_Shoot */
export function eshotShoot(w: World, enemy: Ship, gun: number): void {
  const list = w.eshots
  if (list.length >= MAX_ESHOT) return
  const x = enemy.x + (enemy.lib.shootx[gun] ?? 0)
  const y = enemy.y + (enemy.lib.shooty[gun] ?? 0)
  const type = enemy.lib.shoot_type[gun] ?? ES_ATDOWN
  const cur: EShot = {
    id: w.newId(),
    curframe: 0,
    x: 0,
    y: 0,
    move: newMove(x, y),
    doneflag: false,
    lib: LIB_NORMAL,
    cnt: 0,
    speed: 0,
    pos: 0,
    type,
    en: enemy,
    gun_num: gun,
  }
  const m = cur.move
  const fx = (f: Fx) => w.sfx3d(f, x, y)
  switch (type) {
    case ES_ATPLAYER:
    case ES_COCONUTS:
      if (type === ES_COCONUTS) {
        w.rng.random(6) // monkeys[random(6)] picks one of six chatter samples
        fx("MONKEY")
        cur.lib = LIB_COCO
      } else {
        fx("ENEMYSHOT")
        cur.lib = LIB_ATPLAY
      }
      m.x -= cur.lib.xoff
      m.y -= cur.lib.yoff
      m.x2 = w.player_cx
      m.y2 = w.player_cy
      cur.speed = 1
      break
    case ES_ANGLELEFT:
    case ES_ANGLERIGHT:
    case ES_ATDOWN:
      fx("ENEMYSHOT")
      cur.lib = LIB_NORMAL
      m.x -= cur.lib.xoff
      m.y -= cur.lib.yoff
      m.x2 = m.x
      if (type === ES_ANGLELEFT) m.x2 = m.x - 32
      else if (type === ES_ANGLERIGHT) m.x2 = m.x + 32
      m.y2 = type === ES_ATDOWN ? 200 : m.y + 32
      cur.speed = cur.lib.speed >> 1
      break
    case ES_MISSLE:
      fx("ENEMYMISSLE")
      cur.lib = LIB_MISSLE
      m.x -= cur.lib.xoff
      m.x2 = m.x
      m.y2 = 200
      cur.speed = enemy.speed + 1
      break
    case ES_MINES:
      fx("ENEMYSHOT")
      cur.lib = LIB_MINES
      cur.x = m.x
      cur.y = m.y
      m.x2 = 320
      m.y2 = 200
      cur.speed = 150
      cur.pos = w.rng.random(16)
      break
    case ES_LASER:
      fx("ENEMYLASER")
      cur.lib = LIB_LASER
      m.x -= cur.lib.xoff
      m.x2 = m.x
      m.y2 = 200
      cur.speed = enemy.speed
      break
    case ES_PLASMA:
      fx("ENEMYPLASMA")
      cur.lib = LIB_PLASMA
      m.x -= cur.lib.xoff
      m.x2 = m.x
      m.y2 = 200
      cur.speed = 8
      break
    default:
      return // DOS: EXIT_Error("Invalid EShot type")
  }
  initMobj(m)
  moveSobj(m, 1)
  if (m.x < 0 || m.x >= 320) m.done = true
  if (m.y < 0 || m.y >= 200) m.done = true
  if (!m.done) list.push(cur)
}

/** ESHOT_Think for a laser beam: follows its gun, damages the player below it. */
function thinkLaser(w: World, shot: EShot, lib: EShotLib): void {
  if (shot.curframe >= lib.num_frames) {
    shot.doneflag = true
    return
  }
  shot.x = shot.en.x + (shot.en.lib.shootx[shot.gun_num] ?? 0) - 4
  shot.y = shot.en.y + (shot.en.lib.shooty[shot.gun_num] ?? 0)
  shot.move.y2 = 200
  const dx = Math.abs(shot.x - w.player_cx)
  if (dx < PLAYERWIDTH / 2 && shot.y < w.player_cy) {
    shot.move.y2 = w.player_cy + w.rng.random(4) - 2
    w.subEnergy(lib.hits)
  }
}

/** ESHOT_Think for a moving shot or a mine (speed 0: floats on the spot, then explodes). */
function moveShot(w: World, shot: EShot, lib: EShotLib): void {
  if (lib.speed) {
    shot.x = shot.move.x
    shot.y = shot.move.y
    moveSobj(shot.move, shot.speed)
    if (shot.speed < lib.speed) shot.speed++
    return
  }
  shot.speed--
  if (!shot.speed) {
    shot.doneflag = true
    w.startAnim(Anim.SMALL_AIR_EXPLO, shot.x + 4, shot.y + 4)
    return
  }
  shot.x = shot.move.x + (XPOS[shot.pos] as number)
  shot.y = shot.move.y + (YPOS[shot.pos] as number)
  shot.move.y++
  shot.pos++
  if (shot.pos >= 16) shot.pos = 0
}

/** ESHOT_Think for everything but lasers. */
function thinkShot(w: World, shot: EShot, lib: EShotLib): void {
  if (shot.curframe >= lib.num_frames) shot.curframe = 0
  moveShot(w, shot, lib)
  if (shot.y >= 200 || shot.y < 0) shot.doneflag = true
  if (shot.x >= 320 || shot.x < 0) shot.doneflag = true
  const dx = Math.abs(shot.x - w.player_cx)
  const dy = Math.abs(shot.y - w.player_cy)
  if (dx < PLAYERWIDTH / 2 && dy < PLAYERHEIGHT / 2) {
    w.startAnim(Anim.SMALL_AIR_EXPLO, shot.x, shot.y)
    shot.doneflag = true
    w.subEnergy(lib.hits)
  }
}

/** ESHOT_Think */
export function eshotThink(w: World): void {
  const list = w.eshots
  for (let i = 0; i < list.length; i++) {
    const shot = list[i] as EShot
    const lib = shot.lib
    shot.curframe++
    if (shot.type === ES_LASER) thinkLaser(w, shot, lib)
    else thinkShot(w, shot, lib)
    if (shot.doneflag) {
      list.splice(i--, 1)
      continue
    }
    shot.cnt++
    if (lib.smokeflag && shot.cnt & 1) w.startAAnim(Anim.SMALL_SMOKE_UP, shot.x + lib.xoff, shot.y)
  }
}
