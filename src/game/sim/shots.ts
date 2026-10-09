// Port of dosraptor/SOURCE/SHOTS.C: player weapons.
import { PIC_SIZES } from "../data/ep1"
import { Anim, LAST_WEAPON, O_GUN1, O_GUN2, O_GUN3, Obj, type ObjType } from "./consts"
import {
  enemyDamage,
  enemyDamageEnergy,
  enemyGetRandom,
  enemyGetRandomAir,
  type Ship,
} from "./enemy"
import { initMobj, type MoveObj, moveSobj, newMove } from "./move"
import { tileBomb, tileDamageAll, tileIsHit } from "./tile"
import type { PlayerShip, World } from "./world"

const MAX_SHOTS = 70

type HitType = "all" | "air" | "ground" | "grall" | "gtile" | "suck"
type Beam = "shoot" | "line" | "beam"

export interface ShotLib {
  type: ObjType
  key: string
  hits: number
  speed: number
  maxspeed: number
  startframe: number
  numframes: number
  shoot_rate: number
  cur_shoot: number
  delayflag: boolean
  smoke: boolean
  use_plot: boolean
  move_flag: boolean
  ht: HitType
  fplrx: boolean
  fplry: boolean
  meffect: boolean
  beam: Beam
  hlx: number
  hly: number
}

function slib(o: Omit<ShotLib, "cur_shoot" | "hlx" | "hly">): ShotLib {
  const [w, h] = PIC_SIZES[o.key] ?? [0, 0]
  return { ...o, cur_shoot: 0, hlx: w >> 1, hly: h >> 1 }
}

const base = {
  delayflag: false,
  smoke: false,
  use_plot: false,
  move_flag: true,
  fplrx: false,
  fplry: false,
  meffect: false,
  beam: "shoot" as Beam,
  startframe: 0,
}

/** SHOTS_Init shot_lib (per game: cur_shoot is state). */
export function makeShotLibs(): ShotLib[] {
  const L: ShotLib[] = []
  L[Obj.FORWARD_GUNS] = slib({
    ...base,
    type: Obj.FORWARD_GUNS,
    key: "NMSHOT_BLK",
    hits: 1,
    speed: 8,
    maxspeed: 16,
    numframes: 4,
    shoot_rate: 2,
    ht: "all",
  })
  L[Obj.PLASMA_GUNS] = slib({
    ...base,
    type: Obj.PLASMA_GUNS,
    key: "PLASMA_BLK",
    hits: 2,
    speed: 4,
    maxspeed: 8,
    numframes: 2,
    shoot_rate: 10,
    ht: "air",
  })
  L[Obj.MICRO_MISSLE] = slib({
    ...base,
    type: Obj.MICRO_MISSLE,
    key: "MICROM_BLK",
    hits: 2,
    speed: 2,
    maxspeed: 8,
    numframes: 2,
    shoot_rate: 4,
    ht: "grall",
  })
  L[Obj.DUMB_MISSLE] = slib({
    ...base,
    type: Obj.DUMB_MISSLE,
    key: "MISDUM_BLK",
    hits: 4,
    speed: 2,
    maxspeed: 12,
    startframe: 1,
    numframes: 3,
    delayflag: true,
    shoot_rate: 10,
    use_plot: true,
    ht: "all",
  })
  L[Obj.MINI_GUN] = slib({
    ...base,
    type: Obj.MINI_GUN,
    key: "NMSHOT_BLK",
    hits: 1,
    speed: 8,
    maxspeed: 10,
    startframe: 1,
    numframes: 4,
    shoot_rate: 1,
    use_plot: true,
    ht: "grall",
  })
  L[Obj.TURRET] = slib({
    ...base,
    type: Obj.TURRET,
    key: "",
    hits: 5,
    speed: 0,
    maxspeed: 0,
    numframes: 0,
    shoot_rate: 6,
    move_flag: false,
    beam: "line",
    ht: "all",
  })
  L[Obj.MISSLE_PODS] = slib({
    ...base,
    type: Obj.MISSLE_PODS,
    key: "MISRAT_BLK",
    hits: 4,
    speed: 1,
    maxspeed: 16,
    numframes: 2,
    shoot_rate: 5,
    smoke: true,
    ht: "air",
  })
  // DOS sets type = S_MISSLE_PODS here too (only matters for the done switch)
  L[Obj.AIR_MISSLE] = slib({
    ...base,
    type: Obj.MISSLE_PODS,
    key: "MISRAT_BLK",
    hits: 4,
    speed: 1,
    maxspeed: 12,
    numframes: 2,
    shoot_rate: 10,
    smoke: true,
    ht: "air",
  })
  L[Obj.GRD_MISSLE] = slib({
    ...base,
    type: Obj.GRD_MISSLE,
    key: "MISGRD_BLK",
    hits: 20,
    speed: 1,
    maxspeed: 6,
    numframes: 2,
    shoot_rate: 20,
    smoke: true,
    ht: "ground",
  })
  L[Obj.BOMB] = slib({
    ...base,
    type: Obj.BOMB,
    key: "BLDGBOMB_PIC",
    hits: 50,
    speed: 1,
    maxspeed: 4,
    numframes: 1,
    shoot_rate: 30,
    ht: "gtile",
  })
  L[Obj.ENERGY_GRAB] = slib({
    ...base,
    type: Obj.ENERGY_GRAB,
    key: "POWDIS_BLK",
    hits: 3,
    speed: 4,
    maxspeed: 8,
    numframes: 6,
    shoot_rate: 2,
    ht: "suck",
  })
  L[Obj.MEGA_BOMB] = slib({
    ...base,
    type: Obj.MEGA_BOMB,
    key: "MEGABM_BLK",
    hits: 50,
    speed: 2,
    maxspeed: 2,
    numframes: 4,
    shoot_rate: 60,
    use_plot: true,
    meffect: true,
    ht: "all",
  })
  L[Obj.PULSE_CANNON] = slib({
    ...base,
    type: Obj.PULSE_CANNON,
    key: "SHOKWV_BLK",
    hits: 5,
    speed: 8,
    maxspeed: 8,
    numframes: 2,
    shoot_rate: 3,
    ht: "all",
  })
  L[Obj.FORWARD_LASER] = slib({
    ...base,
    type: Obj.FORWARD_LASER,
    key: "FRNTLAS_BLK",
    hits: 10,
    speed: 0,
    maxspeed: 0,
    numframes: 4,
    shoot_rate: 7,
    move_flag: false,
    fplrx: true,
    fplry: true,
    meffect: true,
    beam: "beam",
    ht: "air",
  })
  L[Obj.DEATH_RAY] = slib({
    ...base,
    type: Obj.DEATH_RAY,
    key: "DETHRY_BLK",
    hits: 6,
    speed: 0,
    maxspeed: 0,
    numframes: 4,
    shoot_rate: 7,
    move_flag: false,
    fplrx: true,
    fplry: true,
    meffect: true,
    beam: "beam",
    ht: "grall",
  })
  return L
}

export interface Shot {
  id: number
  x: number
  y: number
  move: MoveObj
  speed: number
  curframe: number
  doneflag: boolean
  delayflag: boolean
  startx: number
  starty: number
  lib: ShotLib
  cnt: number
  /** web: the ship that fired it (fplrx/fplry shots follow it) */
  owner: PlayerShip
}

function get(w: World, lib: ShotLib, x: number, y: number): Shot | null {
  if (w.shots.length >= MAX_SHOTS) return null
  const s: Shot = {
    id: w.newId(),
    x,
    y,
    move: newMove(x, y, x, 0),
    speed: lib.speed,
    curframe: 0,
    doneflag: false,
    delayflag: lib.delayflag,
    startx: w.cur.cx,
    starty: w.cur.cy,
    lib,
    cnt: 0,
    owner: w.cur,
  }
  w.cur.stats.shots++
  w.shots.push(s)
  return s
}

function shootForwardGuns(w: World, lib: ShotLib, cx: number, cy: number, pic: number): boolean {
  const gun = O_GUN1[pic] ?? 0
  w.sfx("GUN")
  w.g_flash = 7
  const a = get(w, lib, cx + gun, cy) as Shot
  a.curframe = w.rng.random(lib.numframes)
  w.startAnim(Anim.PLAYER_SHOOT, gun, 0)
  const b = get(w, lib, cx - gun - 1, cy)
  if (!b) return false
  b.curframe = w.rng.random(lib.numframes)
  w.startAnim(Anim.PLAYER_SHOOT, -gun - 1, 0)
  return true
}

function shootDumbMissile(w: World, lib: ShotLib, cx: number, cy: number): boolean {
  const r = w.rng
  w.sfx("MISSLE")
  const a = get(w, lib, cx, cy) as Shot
  a.move.x2 = a.x + r.random(16) + 10
  a.move.y2 = a.y + 5
  initMobj(a.move)
  const b = get(w, lib, cx, cy)
  if (!b) return false
  b.move.x2 = b.x - r.random(16) - 10
  b.move.y2 = b.y + 5
  initMobj(b.move)
  return true
}

// DOS SHOTS_PlayerShoot S_MINI_GUN case never returns FALSE (no target just drops the shot).
function shootMiniGun(w: World, lib: ShotLib, cx: number, cy: number): void {
  const r = w.rng
  const enemy = enemyGetRandom(w)
  if (!enemy) return
  w.sfx("GUN")
  const a = get(w, lib, cx, cy) as Shot
  a.curframe = r.random(lib.numframes)
  a.move.x2 = enemy.x + r.random(enemy.width) - 1
  a.move.y2 = enemy.y + enemy.hly + r.random(enemy.height) - 1
  initMobj(a.move)
}

function shootTurret(w: World, lib: ShotLib, cx: number, cy: number): boolean {
  const r = w.rng
  const enemy = enemyGetRandomAir(w)
  if (!enemy) {
    w.sfx("NOSHOOT")
    return true
  }
  w.sfx("TURRET")
  const a = get(w, lib, cx, cy) as Shot
  enemy.hits -= lib.hits
  enemy.hitBy = w.hitter
  a.move.x = enemy.move.x + r.random(enemy.width) - 1
  a.move.y = enemy.move.y + r.random(enemy.height) - 1
  a.move.x2 = cx
  a.move.y2 = cy
  initMobj(a.move)
  w.startAnim(Anim.LASER_BLAST, a.move.x, a.move.y)
  return true
}

function shootForwardLaser(w: World, lib: ShotLib, cx: number, cy: number, pic: number): boolean {
  const gun = O_GUN3[pic] ?? 0
  w.sfx("LASER")
  const a = get(w, lib, cx + gun, cy) as Shot
  a.move.y2 = -24
  const b = get(w, lib, cx - gun, cy)
  if (!b) return false
  b.move.y2 = -24
  return true
}

/** SHOTS_PlayerShoot */
export function playerShoot(w: World, type: ObjType): boolean {
  const lib = w.cur.shotLib[type]
  if (!lib || lib.cur_shoot) return false
  lib.cur_shoot = lib.shoot_rate
  const pic = w.cur.pic
  const cx = w.cur.cx
  const cy = w.cur.cy
  // SHOTS_Get happens before the switch: a full list returns FALSE without firing
  if (w.shots.length >= MAX_SHOTS) return false

  switch (type) {
    case Obj.FORWARD_GUNS:
      return shootForwardGuns(w, lib, cx, cy, pic)
    case Obj.PLASMA_GUNS: {
      w.sfx("GUN")
      const a = get(w, lib, cx, cy) as Shot
      a.curframe = w.rng.random(lib.numframes)
      break
    }
    case Obj.MICRO_MISSLE:
      w.sfx("GUN")
      w.g_flash = 7
      get(w, lib, cx + (O_GUN3[pic] ?? 0), cy)
      if (!get(w, lib, cx - (O_GUN3[pic] ?? 0), cy)) return false
      break
    case Obj.DUMB_MISSLE:
      return shootDumbMissile(w, lib, cx, cy)
    case Obj.MINI_GUN:
      shootMiniGun(w, lib, cx, cy)
      break
    case Obj.TURRET:
      return shootTurret(w, lib, cx, cy)
    case Obj.MISSLE_PODS:
      w.sfx("GUN")
      get(w, lib, cx + (O_GUN2[pic] ?? 0), cy)
      w.startAnim(Anim.PLAYER_SHOOT, O_GUN2[pic] ?? 0, 1)
      if (!get(w, lib, cx - (O_GUN2[pic] ?? 0), cy)) return false
      w.startAnim(Anim.PLAYER_SHOOT, -(O_GUN2[pic] ?? 0) - 1, 1)
      break
    case Obj.AIR_MISSLE:
    case Obj.GRD_MISSLE:
      w.sfx("MISSLE")
      get(w, lib, cx + (O_GUN2[pic] ?? 0), cy)
      if (!get(w, lib, cx - (O_GUN2[pic] ?? 0), cy)) return false
      break
    case Obj.BOMB:
      w.sfx("MISSLE")
      get(w, lib, cx, cy)
      break
    case Obj.ENERGY_GRAB:
      w.sfx("GUN")
      get(w, lib, cx - 4, cy)
      break
    case Obj.MEGA_BOMB: {
      w.sfx("GUN")
      const a = get(w, lib, cx, cy) as Shot
      a.move.x2 = 160
      a.move.y2 = 75
      initMobj(a.move)
      break
    }
    case Obj.PULSE_CANNON:
      w.sfx("PULSE")
      get(w, lib, cx, cy)
      break
    case Obj.FORWARD_LASER:
      return shootForwardLaser(w, lib, cx, cy, pic)
    case Obj.DEATH_RAY: {
      w.sfx("LASER")
      const a = get(w, lib, cx, cy - 24) as Shot
      a.move.y2 = -24
      break
    }
    default:
      return false
  }
  return true
}

function spark(w: World, x: number, y: number): void {
  w.startAnim(w.rng.random(2) ? Anim.BLUE_SPARK : Anim.ORANGE_SPARK, x, y)
}

/** Beam shots stop at the first enemy they damage (`enemy.hits !== -1`). */
function beamTarget(w: World, shot: Shot, lib: ShotLib): void {
  for (const enemy of w.enemies.ships) {
    if (shot.x > enemy.x && shot.x < enemy.x2 && enemy.y < shot.owner.cy && enemy.y > -30) {
      enemy.hits -= lib.hits
      enemy.hitBy = w.hitter
      if (enemy.hits !== -1) {
        shot.move.y2 = enemy.y + enemy.hly
        return
      }
    }
  }
}

/** SHOTS_Think: position from the mobj. */
function placeShot(w: World, shot: Shot, lib: ShotLib): void {
  switch (lib.beam) {
    case "shoot":
      shot.x = shot.move.x - lib.hlx
      shot.y = lib.move_flag ? shot.move.y - lib.hly : shot.move.y
      if (lib.smoke) w.startAnim(Anim.SMALL_SMOKE_DOWN, shot.x + lib.hlx, shot.y + (lib.hly << 1))
      break
    case "line":
      shot.x = shot.move.x
      shot.y = shot.move.y
      break
    case "beam":
      shot.x = shot.move.x - lib.hlx
      shot.y = shot.move.y
      beamTarget(w, shot, lib)
      break
  }
  if (lib.fplrx) shot.x += shot.owner.cx - shot.startx
  if (lib.fplry) shot.y += shot.owner.cy - shot.starty
}

/** SHOTS_Think: leaving the screen, animation end, doneflag. Returns true to skip the hit tests. */
function ageShot(shot: Shot, lib: ShotLib): boolean {
  if ((shot.y + 16 < 0 || shot.x < 0 || shot.x > 320 || shot.y > 200) && lib.move_flag) {
    shot.move.done = true
    return true
  }
  if (!shot.delayflag) {
    if (shot.speed < lib.maxspeed) shot.speed++
    shot.curframe++
    if (shot.curframe >= lib.numframes) {
      if (lib.move_flag) shot.curframe = lib.startframe
      else {
        shot.move.done = true
        return true
      }
    }
  }
  if (!shot.doneflag) return false
  shot.move.done = true
  return true
}

/** SHOTS_Think: damage enemies / tiles by hit type. */
function hitShot(w: World, shot: Shot, lib: ShotLib): void {
  switch (lib.ht) {
    case "suck": {
      const enemy: Ship | null = enemyDamageEnergy(w, shot.x, shot.y, lib.hits)
      if (enemy) {
        shot.doneflag = true
        w.startAnim(Anim.BLUE_SPARK, shot.x, shot.y)
        w.startEAnim(enemy, Anim.ENERGY_GRAB, enemy.hlx, enemy.hly)
      }
      break
    }
    case "grall":
      if (enemyDamage(w, "all", shot.x, shot.y, lib.hits)) {
        shot.doneflag = true
        spark(w, shot.x, shot.y)
      }
      break
    case "all":
      if (enemyDamage(w, "all", shot.x, shot.y, lib.hits)) {
        shot.doneflag = true
        spark(w, shot.x, shot.y)
      } else if (tileIsHit(w, lib.hits, shot.x, shot.y)) shot.move.done = true
      break
    case "air":
      if (enemyDamage(w, "air", shot.x, shot.y, lib.hits)) {
        shot.doneflag = true
        spark(w, shot.x, shot.y)
      }
      break
    default:
      hitShotGround(w, shot, lib)
  }
}

/** SHOTS_Think: the ground hit types. */
function hitShotGround(w: World, shot: Shot, lib: ShotLib): void {
  switch (lib.ht) {
    case "ground":
      if (enemyDamage(w, "ground", shot.x, shot.y, lib.hits)) {
        shot.doneflag = true
        w.startAnim(Anim.ORANGE_SPARK, shot.x, shot.y)
      } else if (tileIsHit(w, lib.hits, shot.x, shot.y)) shot.move.done = true
      break
    case "gtile":
      if (tileBomb(w, lib.hits, shot.x, shot.y)) shot.move.done = true
      if (enemyDamage(w, "ground", shot.x, shot.y, 5)) {
        shot.doneflag = true
        w.startAnim(Anim.SMALL_GROUND_EXPLO, shot.x, shot.y)
      }
      break
  }
}

/** SHOTS_Think shot_done: returns true when the shot is removed. */
function finishShot(w: World, shot: Shot, lib: ShotLib): boolean {
  if (shot.delayflag) {
    shot.delayflag = false
    shot.move.x2 = shot.move.x + (w.rng.random(32) - 16)
    shot.move.y2 = 0
    w.startAnim(Anim.SMALL_SMOKE_DOWN, shot.move.x, shot.move.y)
    initMobj(shot.move)
    return false
  }
  if (lib.type === Obj.MEGA_BOMB) {
    w.eshots.length = 0
    tileDamageAll(w)
    for (const enemy of w.enemies.ships) {
      enemy.hits -= lib.hits
      enemy.hitBy = w.hitter
    }
    w.startfadeflag = true
    w.startAnim(Anim.SUPER_SHIELD, 0, 0)
    return true
  }
  return lib.type !== Obj.TURRET
}

/** SHOTS_Think */
export function shotsThink(w: World): void {
  decrementShootRate(w)

  for (let i = 0; i < w.shots.length; i++) {
    const shot = w.shots[i] as Shot
    w.shooter = shot.owner
    if (stepShot(w, shot)) w.shots.splice(i--, 1)
  }
  w.shooter = null
}

function decrementShootRate(w: World): void {
  for (const s of w.ships)
    for (let t = 0; t <= LAST_WEAPON; t++) {
      const l = s.shotLib[t]
      if (l && l.cur_shoot > 0) l.cur_shoot--
    }
}

/** SHOTS_Think: per-shot update; returns true once the shot should be removed. */
function stepShot(w: World, shot: Shot): boolean {
  const lib = shot.lib

  placeShot(w, shot, lib)
  const skipHits = ageShot(shot, lib)
  if (!skipHits && !lib.meffect) hitShot(w, shot, lib)

  if (shot.move.done && finishShot(w, shot, lib)) return true
  if (!lib.move_flag) return false

  if (lib.use_plot) moveSobj(shot.move, shot.speed)
  else {
    shot.move.y -= shot.speed
    if (shot.move.y < 0) {
      shot.move.done = true
      shot.doneflag = true
    }
  }
  return false
}

/**
 * Logic part of SHOTS_Display: S_LINE (turret) shots are drawn once and removed; they move to
 * `w.turretBeams` so the renderer still sees this frame's beams.
 */
export function shotsAfterDisplay(w: World): void {
  for (let i = 0; i < w.shots.length; i++) {
    const s = w.shots[i] as Shot
    if (s.lib.beam === "line") {
      w.turretBeams.push({ x: s.move.x, y: s.move.y, ship: s.owner })
      w.shots.splice(i--, 1)
      continue
    }
    if (s.lib.beam === "beam") s.cnt = (s.cnt + 1) % 4
  }
}
