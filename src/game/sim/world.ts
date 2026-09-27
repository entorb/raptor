// Port of dosraptor/SOURCE/RAP.C Do_Game (one call of `step` = one DOS frame, FRAME_MS) plus
// the player movement of INPUT.C and the in-game logic of RAP_DisplayStats.
import { MAPS } from "../data/ep1"
import type { WaveMap } from "../data/types"
import { type AnimObj, animsThink, startAAnim, startAnim, startEAnim, startGAnim } from "./anims"
import { type Bonus, Bonuses, bonusAdd, bonusThink } from "./bonus"
import {
  Anim,
  DIFF_HARD,
  DIFF_NORMAL,
  DIFF_TRAIN,
  EMPTY,
  END_DURATION,
  END_EXPLODE,
  END_FLYOFF,
  type Fx,
  MAXPLAYERY,
  MINPLAYERY,
  Obj,
  type ObjType,
  PLAYERHEIGHT,
  PLAYERINITX,
  PLAYERINITY,
  PLAYERMAXX,
  PLAYERMINX,
  PLAYERWIDTH,
  SHIELD_LOW,
} from "./consts"
import { EB_EASY_LEVEL, EB_HARD_LEVEL, EB_MED_LEVEL, Enemies, enemyThink, type Ship } from "./enemy"
import { type EShot, eshotThink } from "./eshot"
import type { Inventory } from "./objects"
import { Rng } from "./rng"
import {
  makeShotLibs,
  playerShoot,
  type Shot,
  type ShotLib,
  shotsAfterDisplay,
  shotsThink,
} from "./shots"
import { Tiles, tileScroll, tileThink } from "./tile"

const MAX_ADDX = 10
const MAX_ADDY = 8
/** web: DOS 24 * 4; halved so the recharge is noticeable */
export const CHARGE_SHIELD = 24 * 2
const FADE_FRAMES = 20
const SHAKES = [-4, 4, -3, 3, -2, 2, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, 0, 0]

/** Player controls for one frame. */
export interface FrameInput {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  /** virtual mouse pointer (DOS coords): steers like IPT_GetMouse when set */
  pointer: { x: number; y: number } | null
  fire: boolean
  /** BUT_2: cycle special weapon */
  cycle: boolean
  /** BUT_3: mega bomb */
  mega: boolean
  /** keys 1..0,-: select a special weapon */
  select: ObjType | null
}

export const NO_INPUT: FrameInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  pointer: null,
  fire: false,
  cycle: false,
  mega: false,
  select: null,
}

/** Demo record (INPUT.H RECORD): buttons + forced player position. */
export interface DemoFrame {
  b: [number, number, number, number]
  px: number
  py: number
  pic: number
}

export interface SfxEvent {
  fx: Fx
  /** SND_3DPatch source position (DOS coords), null = SND_Patch (centered, full volume) */
  x: number | null
  y: number | null
  /** random pitch offset (FX.C rpflag: random(40) - 20), in DMX pitch units (128 = normal) */
  rnd: number
}

/** FX.C SND_Setup rpflag: these effects get a random pitch (and consume the game RNG). */
const RANDOM_PITCH = new Set<Fx>([
  "AIREXPLO",
  "AIREXPLO2",
  "GEXPLO",
  "GUN",
  "MISSLE",
  "TURRET",
  "ENEMYSHOT",
  "ENEMYLASER",
  "ENEMYMISSLE",
  "ENEMYPLASMA",
  "SHIT",
  "HIT",
  "PULSE",
  "MONKEY",
])

export interface PlayerState {
  score: number
  sweapon: number
}

/** difficulty -> ENEMY bit mask (LOADSAVE.C RAP_SetPlayerDiff) */
export function diffMask(diff: number): number {
  if (diff >= DIFF_HARD) return EB_EASY_LEVEL | EB_MED_LEVEL | EB_HARD_LEVEL
  if (diff === DIFF_NORMAL) return EB_EASY_LEVEL | EB_MED_LEVEL
  return EB_EASY_LEVEL
}

export class World {
  rng = new Rng()
  plr: PlayerState
  inv: Inventory
  curplr_diff: number
  god = false
  /** web: weaker boss (training beginner wave, `WaveMap.easyBoss`) */
  easyBoss: boolean

  tiles = new Tiles()
  enemies = new Enemies()
  shotLib: ShotLib[] = makeShotLibs()
  shots: Shot[] = []
  eshots: EShot[] = []
  bonus = new Bonuses()
  anims: AnimObj[] = []

  playerx = PLAYERINITX
  playery = PLAYERINITY
  player_cx = PLAYERINITX + PLAYERWIDTH / 2
  player_cy = PLAYERINITY + PLAYERHEIGHT / 2
  playerbasepic = 3
  playerpic = 4
  private oldx = PLAYERINITX
  private g_addx = 0
  private g_addy = 0
  private control_pause = false

  gl_cnt = 0
  startendwave = EMPTY
  end_wave = false
  draw_player = true
  g_flash = 0
  startfadeflag = false
  fadeflag = false
  fadecnt = 0
  private b2_flag = false
  private b3_flag = false
  private objuse_flag = false
  private think_cnt = 0
  private g_oldshield = EMPTY
  private blinkflag = true
  private damage = EMPTY

  /** per-frame outputs for the view (cleared at the start of each step) */
  sfxEvents: SfxEvent[] = []
  turretBeams: { x: number; y: number }[] = []
  kills: { id: number; x: number; y: number; w: number; h: number; ground: boolean }[] = []
  pickups: { type: ObjType; x: number; y: number }[] = []
  /** FX_BOSS1 loops while a boss (song != -1) was spawned */
  bossLoop = false
  /** low shield warning blink (SHLDLOW_PIC) and weapon-lost blink (WEPDEST_PIC) */
  lowShield = false
  weaponLost = false
  frame = 0
  private nextId = 1

  demo: DemoFrame[] | null = null
  private demoPos = 1
  private demoMax = 0

  constructor(
    public wave: number,
    player: PlayerState,
    inv: Inventory,
    diff: number,
    map: WaveMap | undefined = MAPS[wave],
  ) {
    this.plr = player
    this.inv = inv
    this.curplr_diff = diff
    inv.plr = player
    inv.onAdd = () => {
      this.g_oldshield = EMPTY
    }
    if (!map) throw new Error(`no map for wave ${wave}`)
    this.easyBoss = map.easyBoss ?? false
    // Do_Game: srand(1024 * game_wave[cur_game])
    this.rng.srand(1024 * wave)
    this.tiles.load(map.flats)
    this.enemies.load(map.spawns, diffMask(diff))
  }

  /** DEMO_StartPlayback: `frames[0]` is the header record (px = game, py = wave, pic = count). */
  playDemo(frames: DemoFrame[]): void {
    this.demo = frames
    this.demoPos = 1
    this.demoMax = frames[0]?.pic ?? 0
  }

  newId(): number {
    return this.nextId++
  }

  private pitch(fx: Fx): number {
    return RANDOM_PITCH.has(fx) ? this.rng.random(40) - 20 : 0
  }

  /** SND_Patch */
  sfx(fx: Fx): void {
    this.sfxEvents.push({ fx, x: null, y: null, rnd: this.pitch(fx) })
  }

  /** SND_3DPatch; most DOS callers pass the x position twice (y = x). */
  sfx3d(fx: Fx, x: number, y = x): void {
    this.sfxEvents.push({ fx, x, y, rnd: this.pitch(fx) })
  }

  startAnim(h: number, x: number, y: number): void {
    startAnim(this, h, x, y)
  }

  startGAnim(h: number, x: number, y: number): void {
    startGAnim(this, h, x, y)
  }

  startAAnim(h: number, x: number, y: number): void {
    startAAnim(this, h, x, y)
  }

  startEAnim(en: Ship, h: number, x: number, y: number): void {
    startEAnim(this, en, h, x, y)
  }

  bonusAdd(type: ObjType, x: number, y: number): void {
    bonusAdd(this, type, x, y)
  }

  get bonuses(): Bonus[] {
    return this.bonus.list
  }

  get shield(): number {
    return this.inv.getAmt(Obj.ENERGY)
  }

  get dead(): boolean {
    return this.shield <= 0
  }

  /** web: percent of spawned enemies / map structures destroyed (null = none in this wave) */
  get destroyedPct(): { enemies: number | null; buildings: number | null } {
    const pct = (n: number, of: number) => (of ? Math.floor((n * 100) / of) : null)
    return {
      enemies: pct(this.enemies.killed, this.enemies.spawned),
      buildings: pct(this.tiles.destroyed, this.tiles.structs),
    }
  }

  /** OBJS_SubEnergy */
  subEnergy(amt: number): number {
    if (this.god) return 0
    if (this.startendwave !== EMPTY) return 0
    if (this.curplr_diff === DIFF_TRAIN && amt > 1) amt >>= 1
    const sup = this.inv.p_objs[Obj.SUPER_SHIELD]
    if (sup) {
      this.startAnim(Anim.SUPER_SHIELD, 0, 0)
      this.sfx("SHIT")
      sup.num -= amt
      if (sup.num < 0) this.inv.del(Obj.SUPER_SHIELD)
      return sup.num
    }
    const cur = this.inv.p_objs[Obj.ENERGY]
    if (!cur) return 0
    this.sfx("HIT")
    cur.num = Math.max(0, cur.num - amt)
    return cur.num
  }

  private use(type: ObjType): void {
    if (this.inv.use(type, (t) => playerShoot(this, t))) {
      this.objuse_flag = true
    }
  }

  /**
   * OBJS_Think: slow shield recharge while not firing (not on hard).
   * web: firing pauses the counter instead of resetting it (DOS `think_cnt = 0` in OBJS_Use).
   */
  private objsThink(): void {
    if (this.curplr_diff >= DIFF_HARD) return
    if (this.objuse_flag) {
      this.objuse_flag = false
      return
    }
    this.think_cnt++
    if (this.think_cnt > CHARGE_SHIELD) {
      if (this.startendwave === EMPTY) this.inv.addEnergy(1)
      this.think_cnt = 0
    }
  }

  private keyAccel(neg: boolean, pos: boolean, v: number, max: number): number {
    if (neg) return Math.max(-max, (v >= 0 ? -1 : v) - 1)
    if (pos) return Math.min(max, (v <= 0 ? 1 : v) + 1)
    return Math.trunc(v / 2)
  }

  /** IPT_GetMouse: steer towards the (virtual) pointer. */
  private mouseAxis(d: number): number {
    if (d === 0) return 0
    d >>= 3
    if (d === 0) return 1
    return Math.max(-10, Math.min(10, d))
  }

  /** IPT_MovePlayer */
  private movePlayer(inp: FrameInput): void {
    if (!this.control_pause) {
      if (inp.pointer) {
        this.g_addx = this.mouseAxis(Math.round(inp.pointer.x) - (this.playerx + PLAYERWIDTH / 2))
        this.g_addy = this.mouseAxis(Math.round(inp.pointer.y) - (this.playery + PLAYERHEIGHT / 2))
      } else {
        this.g_addx = this.keyAccel(inp.left, inp.right, this.g_addx, MAX_ADDX)
        this.g_addy = this.keyAccel(inp.up, inp.down, this.g_addy, MAX_ADDY)
      }
    }
    this.applyMove()
  }

  private clampPlayer(): void {
    if (this.playery < MINPLAYERY) {
      this.playery = MINPLAYERY
      this.g_addy = 0
    } else if (this.playery > MAXPLAYERY) {
      this.playery = MAXPLAYERY
      this.g_addy = 0
    }
    if (this.playerx < PLAYERMINX) {
      this.playerx = PLAYERMINX
      this.g_addx = 0
    } else if (this.playerx + PLAYERWIDTH > PLAYERMAXX) {
      this.playerx = PLAYERMAXX - PLAYERWIDTH
      this.g_addx = 0
    }
  }

  private applyMove(): void {
    this.playerx += this.g_addx
    this.playery += this.g_addy
    if (this.startendwave === EMPTY) this.clampPlayer()
    const delta = Math.min(3, Math.abs(this.playerx - this.oldx) >> 2)
    if (this.playerx < this.oldx) {
      if (this.playerpic < this.playerbasepic + delta) this.playerpic++
    } else if (this.playerx > this.oldx) {
      if (this.playerpic > this.playerbasepic - delta) this.playerpic--
    } else if (this.playerpic > this.playerbasepic) this.playerpic--
    else if (this.playerpic < this.playerbasepic) this.playerpic++
    this.oldx = this.playerx
    this.player_cx = this.playerx + PLAYERWIDTH / 2
    this.player_cy = this.playery + PLAYERHEIGHT / 2
  }

  /** DEMO_Think (playback): recorded buttons and player position; null when the demo is over. */
  private demoStep(): DemoFrame | null {
    const r = this.demo?.[this.demoPos]
    this.demoPos++
    if (!r || this.demoPos > this.demoMax) {
      this.end_wave = true
      return null
    }
    this.playerx = r.px
    this.playery = r.py
    this.player_cx = r.px + PLAYERWIDTH / 2
    this.player_cy = r.py + PLAYERHEIGHT / 2
    this.playerpic = r.pic
    return r
  }

  /** Fire, cycle-weapon and mega-bomb buttons (the latter two fire once per press). */
  private buttons(but: boolean[]): void {
    if (but[0]) {
      this.use(Obj.FORWARD_GUNS)
      this.use(Obj.PLASMA_GUNS)
      this.use(Obj.MICRO_MISSLE)
      if (this.plr.sweapon !== EMPTY) this.use(this.plr.sweapon as ObjType)
    }
    if (!but[1]) this.b2_flag = false
    else if (!this.b2_flag) {
      this.sfx("SWEP")
      this.b2_flag = true
      this.inv.getNext()
    }
    if (!but[2]) this.b3_flag = false
    else if (!this.b3_flag) {
      this.b3_flag = true
      this.use(Obj.MEGA_BOMB)
    }
  }

  /** One Do_Game iteration. Returns false once the wave is over (end_wave). */
  step(inp: FrameInput): boolean {
    if (this.end_wave) return false
    this.sfxEvents = []
    this.turretBeams = []
    this.kills = []
    this.pickups = []
    this.bossLoop = false
    this.g_flash = 0
    this.frame++

    let but = [inp.fire, inp.cycle, inp.mega]
    if (this.demo) {
      const r = this.demoStep()
      if (!r) return false
      but = [!!r.b[0], !!r.b[1], !!r.b[2]]
    } else this.movePlayer(inp)

    if (inp.select !== null) this.inv.makeSpecial(inp.select)
    this.buttons(but)

    if (this.startendwave !== EMPTY) {
      if (this.startendwave === 0) this.end_wave = true
      this.startendwave--
    }

    this.gl_cnt++

    tileThink(this)
    enemyThink(this)
    eshotThink(this)
    bonusThink(this)
    shotsThink(this)
    animsThink(this)
    this.objsThink()

    // display-phase logic
    tileScroll(this)
    shotsAfterDisplay(this)
    if (this.fadeflag) {
      if (this.fadecnt >= FADE_FRAMES - 1) this.fadeflag = false
      else this.fadecnt++
    }
    this.displayStats()
    if (this.startfadeflag) {
      this.sfx("GEXPLO")
      this.sfx("AIREXPLO")
      this.startfadeflag = false
      this.fadeflag = true
      this.fadecnt = 0
    }
    return !this.end_wave
  }

  /** Screen shake offset (mega bomb) in DOS pixels. */
  get shake(): number {
    return this.fadeflag ? (SHAKES[this.fadecnt] ?? 0) : 0
  }

  /** Logic of RAP_DisplayStats: death explosion, fly-off at wave end, low shield losses. */
  private displayStats(): void {
    const sup = this.inv.getAmt(Obj.SUPER_SHIELD)
    const shield = this.inv.getAmt(Obj.ENERGY)

    if (shield <= 0 && !this.god) this.playerDeath()
    if (this.startendwave !== EMPTY && shield > 0) this.flyOff()
    this.lowShield = false
    if (shield <= SHIELD_LOW && !this.god) this.lowShieldWarning(shield, sup)
    this.weaponLost = this.lowShield && this.damage > 0
    this.g_oldshield = shield
  }

  /** RAP_DisplayStats: explosions while the player ship dies. */
  private playerDeath(): void {
    const r = this.rng
    // Watcom evaluates call arguments right to left
    let y = this.playery + r.random(32)
    this.startAnim(Anim.MED_AIR_EXPLO, this.playerx + r.random(32), y)
    y = this.playery + r.random(32)
    this.startAnim(Anim.SMALL_AIR_EXPLO, this.playerx + r.random(32), y)
    if (this.startendwave > END_EXPLODE) {
      r.random(2)
      this.sfx("AIREXPLO")
    }
    if (this.startendwave === EMPTY) this.startendwave = END_DURATION
    if (this.startendwave !== END_EXPLODE) return
    this.draw_player = false
    this.sfx("AIREXPLO")
    this.sfx("AIREXPLO2")
    this.startAnim(Anim.LARGE_AIR_EXPLO, this.player_cx, this.player_cy)
    for (let loop = 0; loop < (PLAYERWIDTH * PLAYERHEIGHT) / 2; loop++) {
      const x = this.playerx - PLAYERWIDTH / 2 + r.random(PLAYERWIDTH * 2)
      const yy = this.playery - PLAYERHEIGHT / 2 + r.random(PLAYERHEIGHT * 2)
      if (loop & 1) this.startAnim(Anim.LARGE_AIR_EXPLO, x, yy)
      else this.startAAnim(Anim.MED_AIR_EXPLO2, x, yy)
    }
  }

  /** RAP_DisplayStats: the ship flies off the top after the wave is won. */
  private flyOff(): void {
    if (this.startendwave === END_FLYOFF) {
      this.control_pause = true
      this.sfx("FLYBY")
    }
    if (this.startendwave >= END_FLYOFF) return
    let x = 0
    if (this.playerx < 160 - 8) x = 8
    else if (this.playerx > 160 + 8) x = -8
    // IPT_FMovePlayer
    this.g_addx = x
    this.g_addy = -4
    if (!this.demo) this.applyMove()
  }

  /** RAP_DisplayStats: blinking warning, weapon loss on shield hits. */
  private lowShieldWarning(shield: number, sup: number): void {
    if (this.gl_cnt % 8 === 0) {
      this.blinkflag = !this.blinkflag
      if (this.blinkflag && this.damage) this.damage--
    }
    if (shield < this.g_oldshield && sup < 1 && this.inv.loseObj()) {
      this.sfx("CRASH")
      this.damage = 2
    }
    if (this.blinkflag) {
      this.lowShield = true
      if (this.startendwave === EMPTY) this.sfx("WARNING")
    }
  }
}
