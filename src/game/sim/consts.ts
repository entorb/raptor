// Constants from dosraptor/SOURCE (MAP.H, PUBLIC.H, RAPTOR.H). All sim coordinates are DOS
// screen pixels (320x200); the renderer scales them by SCALE.

export const MAP_ROWS = 150
export const MAP_COLS = 9
export const MAP_ONSCREEN = 8
export const MAP_BLOCKSIZE = 32
export const MAP_SIZE = MAP_ROWS * MAP_COLS
export const MAP_LEFT = 16
export const MAP_BOTTOM = 200 - 18

/** Circle offsets (16 steps) shared by bonus pickups and enemy mines. */
export const XPOS = [-1, 0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2, -3, -3, -3, -2]
export const YPOS = [-3, -3, -3, -2, -1, 0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2]

export const PLAYERWIDTH = 32
export const PLAYERHEIGHT = 32
export const PLAYERMINX = 5
export const PLAYERMAXX = 314
export const PLAYERINITX = 160 - PLAYERWIDTH / 2
export const PLAYERINITY = 160
export const MINPLAYERY = 0
export const MAXPLAYERY = 160

export const MAX_SHIELD = 100
export const SHIELD_LOW = 10
export const END_DURATION = 20 * 3
export const END_EXPLODE = 24
export const END_FLYOFF = 20 * 2
export const EMPTY = -1

export const MAX_ONSCREEN = 30

/** Difficulty (PUBLIC.H DIFF_0..3). */
export const DIFF_TRAIN = 0
export const DIFF_EASY = 1
export const DIFF_NORMAL = 2
export const DIFF_HARD = 3

/** WINDOWS.C diff_wrap: waves per episode by difficulty (training ends after 4). */
export const DIFF_WRAP = [4, 9, 9, 9]

/** DOS frame = 3 ticks of the 70 Hz VGA counter (RAP.C Do_Game), ~23.3 Hz. */
export const FRAME_MS = (3 * 1000) / 70

/** RAP.C ship gun/engine x offsets per bank frame (playerpic 0..6). */
export const O_GUN1 = [1, 3, 5, 6, 5, 3, 1]
export const O_GUN2 = [1, 3, 6, 9, 6, 3, 2]
export const O_GUN3 = [2, 6, 8, 11, 8, 6, 2]

/** OBJECTS.H OBJ_TYPE. */
export const Obj = {
  FORWARD_GUNS: 0,
  PLASMA_GUNS: 1,
  MICRO_MISSLE: 2,
  DUMB_MISSLE: 3,
  MINI_GUN: 4,
  TURRET: 5,
  MISSLE_PODS: 6,
  AIR_MISSLE: 7,
  GRD_MISSLE: 8,
  BOMB: 9,
  ENERGY_GRAB: 10,
  MEGA_BOMB: 11,
  PULSE_CANNON: 12,
  FORWARD_LASER: 13,
  DEATH_RAY: 14,
  SUPER_SHIELD: 15,
  ENERGY: 16,
  DETECT: 17,
  ITEMBUY1: 18,
  ITEMBUY2: 19,
  ITEMBUY3: 20,
  ITEMBUY4: 21,
  ITEMBUY5: 22,
  ITEMBUY6: 23,
  LAST_OBJECT: 24,
} as const
export type ObjType = (typeof Obj)[keyof typeof Obj]
export const LAST_WEAPON = Obj.DEATH_RAY

/** ANIMS.H handles (registration order in ANIMS_Init). */
export const Anim = {
  LARGE_GROUND_EXPLO1: 0,
  SMALL_GROUND_EXPLO: 1,
  PERSON: 2,
  PLATOON: 3,
  LARGE_AIR_EXPLO: 4,
  MED_AIR_EXPLO: 5,
  SMALL_AIR_EXPLO: 6,
  MED_AIR_EXPLO2: 7,
  ENERGY_AIR_EXPLO: 8,
  LASER_BLAST: 9,
  SMALL_SMOKE: 10,
  SMALL_SMOKE_DOWN: 11,
  SMALL_SMOKE_UP: 12,
  ENERGY_GRAB_HIT: 13,
  BLUE_SPARK: 14,
  ORANGE_SPARK: 15,
  PLAYER_SHOOT: 16,
  GROUND_FLARE: 17,
  GROUND_SPARKLE: 18,
  ENERGY_GRAB: 19,
  SUPER_SHIELD: 20,
} as const

/** FX.H sound effects used by the game loop (see audio manifest for sample/pitch). */
export type Fx =
  | "AIREXPLO"
  | "AIREXPLO2"
  | "BONUS"
  | "CRASH"
  | "FLYBY"
  | "EGRAB"
  | "GEXPLO"
  | "GUN"
  | "LASER"
  | "MISSLE"
  | "SWEP"
  | "TURRET"
  | "WARNING"
  | "BOSS1"
  | "ENEMYSHOT"
  | "ENEMYLASER"
  | "ENEMYMISSLE"
  | "ENEMYPLASMA"
  | "SHIT"
  | "HIT"
  | "NOSHOOT"
  | "PULSE"
  | "MONKEY"
