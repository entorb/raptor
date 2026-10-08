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
import type { Inventory, SpecialSlot } from "./objects"
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
  /** web only: cycle special weapon backwards */
  cyclePrev?: boolean
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
  /** web: player 2's special weapon (2P co-op) */
  sweapon2?: number
}

/** web: one player ship (DOS globals playerx, playery, playerpic, ...); 2P co-op flies two. */
export class PlayerShip {
  x: number
  y: number
  cx = 0
  cy = 0
  basepic = 3
  pic = 4
  oldx: number
  addx = 0
  addy = 0
  /** per ship: `cur_shoot` is its fire cooldown */
  shotLib: ShotLib[] = makeShotLibs()
  b2 = false
  b3 = false
  b4 = false
  /** fly-off target x (DOS: the screen center); 2P: own lane per ship */
  exitX = 160

  constructor(
    readonly slot: SpecialSlot,
    x = PLAYERINITX,
    y = PLAYERINITY,
  ) {
    this.x = x
    this.y = y
    this.oldx = x
    this.syncCenter()
  }

  syncCenter(): void {
    this.cx = this.x + PLAYERWIDTH / 2
    this.cy = this.y + PLAYERHEIGHT / 2
  }
}

/** web: 2P start offset from the DOS start position */
const COOP_START_DX = 40

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
  shots: Shot[] = []
  eshots: EShot[] = []
  bonus = new Bonuses()
  anims: AnimObj[] = []

  ships: PlayerShip[]
  /** the ship being processed (fires, gets hit); always ships[0] in 1P */
  cur: PlayerShip
  private control_pause = false

  gl_cnt = 0
  startendwave = EMPTY
  end_wave = false
  draw_player = true
  g_flash = 0
  startfadeflag = false
  fadeflag = false
  fadecnt = 0
  private objuse_flag = false
  private think_cnt = 0
  /** web: shield recharge ticks (HUD plays a sound when a bar segment lights up) */
  recharges = 0
  private g_oldshield = EMPTY
  private blinkflag = true
  private damage = EMPTY

  /** per-frame outputs for the view (cleared at the start of each step) */
  sfxEvents: SfxEvent[] = []
  turretBeams: { x: number; y: number; ship: PlayerShip }[] = []
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
    players = 1,
  ) {
    this.ships =
      players > 1
        ? [
            // player 2 (WASD, left hand) starts left, player 1 (arrows) right
            new PlayerShip("sweapon", PLAYERINITX + COOP_START_DX),
            new PlayerShip("sweapon2", PLAYERINITX - COOP_START_DX),
          ]
        : [new PlayerShip("sweapon")]
    this.cur = this.ships[0] as PlayerShip
    this.plr = player
    this.inv = inv
    this.curplr_diff = diff
    inv.plr = player
    if (players > 1 && (player.sweapon2 ?? EMPTY) === EMPTY) inv.getNext(1, "sweapon2")
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

  /** web: the ship closest to x/y (enemy aim); P1 on a tie */
  nearestShip(x: number, y: number): PlayerShip {
    let best = this.cur
    let bestD = Infinity
    for (const s of this.ships) {
      const d = (s.cx - x) ** 2 + (s.cy - y) ** 2
      if (d < bestD) {
        best = s
        bestD = d
      }
    }
    return best
  }

  /** `cur` takes the hit (phase shield glow, weapon loss). */
  hitShip(s: PlayerShip, amt: number): number {
    this.cur = s
    return this.subEnergy(amt)
  }

  get dead(): boolean {
    return this.shield <= 0
  }

  /** web: percent of seen enemies / map structures destroyed (null = none in this wave) */
  get destroyedPct(): { enemies: number | null; buildings: number | null } {
    const pct = (n: number, of: number) => (of ? Math.floor((n * 100) / of) : null)
    return {
      enemies: pct(this.enemies.killed, this.enemies.seen),
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
    if (!this.inv.p_objs[Obj.ENERGY]) return 0
    this.sfx("HIT")
    return this.inv.subAmt(Obj.ENERGY, amt)
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
      if (this.startendwave === EMPTY && this.inv.addEnergy(1)) this.recharges++
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
  private movePlayer(s: PlayerShip, inp: FrameInput): void {
    if (!this.control_pause) {
      if (inp.pointer) {
        s.addx = this.mouseAxis(Math.round(inp.pointer.x) - (s.x + PLAYERWIDTH / 2))
        s.addy = this.mouseAxis(Math.round(inp.pointer.y) - (s.y + PLAYERHEIGHT / 2))
      } else {
        s.addx = this.keyAccel(inp.left, inp.right, s.addx, MAX_ADDX)
        s.addy = this.keyAccel(inp.up, inp.down, s.addy, MAX_ADDY)
      }
    }
    this.applyMove(s)
  }

  private clampPlayer(s: PlayerShip): void {
    if (s.y < MINPLAYERY) {
      s.y = MINPLAYERY
      s.addy = 0
    } else if (s.y > MAXPLAYERY) {
      s.y = MAXPLAYERY
      s.addy = 0
    }
    if (s.x < PLAYERMINX) {
      s.x = PLAYERMINX
      s.addx = 0
    } else if (s.x + PLAYERWIDTH > PLAYERMAXX) {
      s.x = PLAYERMAXX - PLAYERWIDTH
      s.addx = 0
    }
  }

  private applyMove(s: PlayerShip): void {
    s.x += s.addx
    s.y += s.addy
    if (this.startendwave === EMPTY) this.clampPlayer(s)
    const delta = Math.min(3, Math.abs(s.x - s.oldx) >> 2)
    if (s.x < s.oldx) {
      if (s.pic < s.basepic + delta) s.pic++
    } else if (s.x > s.oldx) {
      if (s.pic > s.basepic - delta) s.pic--
    } else if (s.pic > s.basepic) s.pic--
    else if (s.pic < s.basepic) s.pic++
    s.oldx = s.x
    s.syncCenter()
  }

  /** DEMO_Think (playback): recorded buttons and player position; null when the demo is over. */
  private demoStep(): DemoFrame | null {
    const r = this.demo?.[this.demoPos]
    this.demoPos++
    if (!r || this.demoPos > this.demoMax) {
      this.end_wave = true
      return null
    }
    const s = this.ships[0] as PlayerShip
    s.x = r.px
    s.y = r.py
    s.syncCenter()
    s.pic = r.pic
    return r
  }

  /** Fire, cycle-weapon and mega-bomb buttons (the latter two fire once per press). */
  private buttons(s: PlayerShip, but: boolean[]): void {
    if (but[0]) {
      this.use(Obj.FORWARD_GUNS)
      this.use(Obj.PLASMA_GUNS)
      this.use(Obj.MICRO_MISSLE)
      const sw = this.plr[s.slot] ?? EMPTY
      if (sw !== EMPTY) this.use(sw as ObjType)
    }
    if (!but[1]) s.b2 = false
    else if (!s.b2) {
      this.sfx("SWEP")
      s.b2 = true
      this.inv.getNext(1, s.slot)
    }
    if (!but[3]) s.b4 = false
    else if (!s.b4) {
      this.sfx("SWEP")
      s.b4 = true
      this.inv.getNext(-1, s.slot)
    }
    if (!but[2]) s.b3 = false
    else if (!s.b3) {
      s.b3 = true
      this.use(Obj.MEGA_BOMB)
    }
  }

  /** One Do_Game iteration (2P: one input per ship). Returns false once the wave is over (end_wave). */
  step(inp: FrameInput | FrameInput[]): boolean {
    if (this.end_wave) return false
    this.sfxEvents = []
    this.turretBeams = []
    this.kills = []
    this.pickups = []
    this.bossLoop = false
    this.g_flash = 0
    this.frame++

    const inputs = Array.isArray(inp) ? inp : [inp]
    let demoBut: boolean[] | null = null
    if (this.demo) {
      const r = this.demoStep()
      if (!r) return false
      demoBut = [!!r.b[0], !!r.b[1], !!r.b[2], false]
    } else for (const [i, s] of this.ships.entries()) this.movePlayer(s, inputs[i] ?? NO_INPUT)

    for (const [i, s] of this.ships.entries()) {
      const p = inputs[i] ?? NO_INPUT
      this.cur = s
      if (p.select !== null) this.inv.makeSpecial(p.select, s.slot)
      this.buttons(s, demoBut ?? [p.fire, p.cycle, p.mega, !!p.cyclePrev])
    }

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

  /** RAP_DisplayStats: explosions while the player ship dies (2P: both ships, shared shield). */
  private playerDeath(): void {
    const r = this.rng
    for (const s of this.ships) {
      // Watcom evaluates call arguments right to left
      let y = s.y + r.random(32)
      this.startAnim(Anim.MED_AIR_EXPLO, s.x + r.random(32), y)
      y = s.y + r.random(32)
      this.startAnim(Anim.SMALL_AIR_EXPLO, s.x + r.random(32), y)
    }
    if (this.startendwave > END_EXPLODE) {
      r.random(2)
      this.sfx("AIREXPLO")
    }
    if (this.startendwave === EMPTY) this.startendwave = END_DURATION
    if (this.startendwave !== END_EXPLODE) return
    this.draw_player = false
    this.sfx("AIREXPLO")
    this.sfx("AIREXPLO2")
    for (const s of this.ships) this.shipExplodes(s)
  }

  /** RAP_DisplayStats: the final burst around a ship. */
  private shipExplodes(s: PlayerShip): void {
    const r = this.rng
    this.startAnim(Anim.LARGE_AIR_EXPLO, s.cx, s.cy)
    for (let loop = 0; loop < (PLAYERWIDTH * PLAYERHEIGHT) / 2; loop++) {
      const x = s.x - PLAYERWIDTH / 2 + r.random(PLAYERWIDTH * 2)
      const yy = s.y - PLAYERHEIGHT / 2 + r.random(PLAYERHEIGHT * 2)
      if (loop & 1) this.startAnim(Anim.LARGE_AIR_EXPLO, x, yy)
      else this.startAAnim(Anim.MED_AIR_EXPLO2, x, yy)
    }
  }

  /** RAP_DisplayStats: the ship flies off the top after the wave is won. */
  private flyOff(): void {
    if (this.startendwave === END_FLYOFF) {
      this.control_pause = true
      this.sfx("FLYBY")
      this.flyLanes()
    }
    if (this.startendwave >= END_FLYOFF) return
    for (const s of this.ships) {
      let x = 0
      if (s.x < s.exitX - 8) x = 8
      else if (s.x > s.exitX + 8) x = -8
      // IPT_FMovePlayer
      s.addx = x
      s.addy = -4
      if (!this.demo) this.applyMove(s)
    }
  }

  /** web: 2P ships fly off in separate lanes, the left one left of center (they never cross). */
  private flyLanes(): void {
    const [left, right] = [...this.ships].sort((a, b) => a.x - b.x)
    if (!left || !right) return
    left.exitX = 160 - COOP_START_DX
    right.exitX = 160 + COOP_START_DX
  }

  /** RAP_DisplayStats: blinking warning, weapon loss on shield hits. */
  private lowShieldWarning(shield: number, sup: number): void {
    if (this.gl_cnt % 8 === 0) {
      this.blinkflag = !this.blinkflag
      if (this.blinkflag && this.damage) this.damage--
    }
    if (shield < this.g_oldshield && sup < 1 && this.inv.loseObj(this.cur.slot)) {
      this.sfx("CRASH")
      this.damage = 2
    }
    if (this.blinkflag) {
      this.lowShield = true
      if (this.startendwave === EMPTY) this.sfx("WARNING")
    }
  }
}
