// Bugger Nest sector (web-only): Formic insect swarms over an organic hive. Not in
// DOS: an own enemy library (ENEMY.H SPRITE records flown by the unchanged sim) and seeded waves
// expanded from a short spec per wave. Every bug takes the stats of the Bravo unit it stands in
// for (named in its comment), so the difficulty stays close to the DOS episode.
import { MAP_COLS, Obj } from "../sim/consts"
import {
  EXP_AIRLARGE,
  EXP_AIRMED,
  EXP_AIRSMALL1,
  EXP_AIRSMALL2,
  EXP_BOSS,
  EXP_ENERGY,
  EXP_GRDLARGE,
  EXP_GRDMED,
  F_GROUND,
  F_GROUNDLEFT,
  F_GROUNDRIGHT,
  F_KAMI,
  F_LINEAR,
  F_REPEAT,
} from "../sim/enemy"
import {
  ES_ANGLELEFT,
  ES_ANGLERIGHT,
  ES_ATDOWN,
  ES_ATPLAYER,
  ES_COCONUTS,
  ES_MISSLE,
  ES_PLASMA,
} from "../sim/eshot"
import { Rng } from "../sim/rng"
import { hiveTerrain } from "./s3_hive"
import type { EnemyLib, WaveMap } from "./types"

type Pt = [number, number]
/** [ES_* shot type, x, y] in DOS px from the sprite's top-left */
type Gun = [number, number, number]
type Opts = Partial<Omit<EnemyLib, "iname" | "w" | "h">> & { path?: Pt[]; guns?: Gun[] }

/** Defaults: a flapping air bug (4 frame loop) that flies its path once. */
const BASE: Omit<EnemyLib, "iname" | "w" | "h"> = {
  bonus: -1,
  exptype: EXP_AIRSMALL1,
  shotspace: 4,
  ground: 0,
  suck: 1,
  frame_rate: 1,
  num_frames: 4,
  countdown: 0,
  rewind: 4,
  animtype: 0,
  shadow: 1,
  bossflag: 0,
  hits: 7,
  money: 350,
  shootstart: 0,
  shootcnt: 1,
  shootframe: 20,
  movespeed: 2,
  numflight: 0,
  repos: 0,
  flighttype: F_LINEAR,
  numguns: 0,
  numengs: 0,
  sfx: -1,
  song: -1,
  shoot_type: [],
  engx: [],
  engy: [],
  englx: [],
  shootx: [],
  shooty: [],
  flightx: [],
  flighty: [],
}

function bug(iname: string, w: number, h: number, { path = [], guns = [], ...o }: Opts): EnemyLib {
  return {
    ...BASE,
    ...o,
    iname,
    w,
    h,
    numflight: path.length,
    flightx: path.map((p) => p[0]),
    flighty: path.map((p) => p[1]),
    numguns: guns.length,
    shoot_type: guns.map((g) => g[0]),
    shootx: guns.map((g) => g[1]),
    shooty: guns.map((g) => g[2]),
  }
}

const mirror = (p: Pt[]): Pt[] => p.map(([x, y]) => [-x, y])
/** Ground units: one frame, no shadow, scroll with the map. */
const GROUND: Opts = {
  flighttype: F_GROUND,
  suck: 0,
  shadow: 0,
  num_frames: 1,
  rewind: 1,
  frame_rate: 0,
  movespeed: 1,
  exptype: EXP_GRDMED,
}
/** Bosses hover on a ping-pong path (F_REPEAT) and loop the boss sound. */
const BOSS: Opts = {
  flighttype: F_REPEAT,
  bossflag: 1,
  exptype: EXP_BOSS,
  suck: 0,
  num_frames: 4,
  rewind: 4,
  frame_rate: 2,
}

/**
 * Path variants of one unit: [any column] or [center, left columns, right columns]. `side` paths
 * steer right (+x) and are mirrored for the right columns, so bugs sweep across the screen.
 */
function variants(make: (path: Pt[]) => EnemyLib, center: Pt[] | null, side?: Pt[]): EnemyLib[] {
  const out = center ? [make(center)] : []
  if (side) out.push(make(side), make(mirror(side)))
  return out
}

const DOWN: Pt[] = [[0, 128]]

/** Air units by kind (variant lists, see `variants`). */
const AIR = {
  // SHIP01: fodder drone, straight or hooking dive
  drone: variants((path) => bug("BUG_DRONE", 32, 24, { path, guns: [[ES_ATDOWN, 16, 20]] }), DOWN, [
    [0, -72],
    [64, -8],
    [64, 128],
  ]),
  // SHIP39: fast swarmlings, no guns, fly in linked packs
  ling: variants(
    (path) =>
      bug("BUG_LING", 24, 24, { path, hits: 3, money: 300, movespeed: 7, exptype: EXP_AIRSMALL2 }),
    DOWN,
    [
      [0, -40],
      [24, 8],
      [56, 40],
      [120, 72],
      [176, 128],
    ],
  ),
  // SHIP14: twin acid spitter
  spitter: variants(
    (path) =>
      bug("BUG_SPITTER", 32, 24, {
        path,
        hits: 8,
        money: 500,
        movespeed: 4,
        exptype: EXP_AIRMED,
        guns: [
          [ES_ATDOWN, 10, 20],
          [ES_ATDOWN, 22, 20],
        ],
      }),
    null,
    [
      [0, -72],
      [80, 8],
      [80, 128],
    ],
  ),
  // SHIP05: zig-zagging mantis
  mantis: variants(
    (path) =>
      bug("BUG_MANTIS", 40, 32, {
        path,
        hits: 6,
        money: 350,
        movespeed: 3,
        exptype: EXP_AIRMED,
        shootframe: 25,
        guns: [
          [ES_ATDOWN, 8, 26],
          [ES_ATDOWN, 32, 26],
        ],
      }),
    [
      [0, -88],
      [24, -40],
      [0, 8],
      [-24, 56],
      [0, 104],
      [0, 128],
    ],
    [
      [0, -40],
      [88, 48],
      [88, 128],
    ],
  ),
  // SHIP28: hornet strafing sideways with missiles
  hornet: variants(
    (path) =>
      bug("BUG_HORNET", 32, 32, {
        path,
        hits: 8,
        money: 500,
        movespeed: 4,
        suck: 0,
        exptype: EXP_AIRMED,
        shootframe: 18,
        guns: [
          [ES_MISSLE, 7, 24],
          [ES_MISSLE, 24, 24],
        ],
      }),
    null,
    [
      [0, -104],
      [16, -24],
      [96, 16],
      [264, 16],
      [264, 128],
    ],
  ),
  // SHIP25: stinger, a short feint then it rams the nearest ship (kamikaze)
  stinger: variants(
    (path) =>
      bug("BUG_STINGER", 32, 24, {
        path,
        flighttype: F_KAMI,
        hits: 10,
        money: 600,
        movespeed: 5,
        exptype: EXP_AIRMED,
        shootframe: 25,
        guns: [
          [ES_ATDOWN, 6, 18],
          [ES_ATDOWN, 26, 18],
        ],
      }),
    null,
    [
      [0, -40],
      [32, 24],
    ],
  ),
  // SHIP03: armored beetle, a fast straight dive with a missile salvo
  beetle: variants(
    (path) =>
      bug("BUG_BEETLE", 40, 40, {
        path,
        hits: 15,
        money: 500,
        movespeed: 6,
        suck: 0,
        exptype: EXP_AIRLARGE,
        shootframe: 12,
        guns: [
          [ES_MISSLE, 11, 30],
          [ES_MISSLE, 28, 30],
          [ES_MISSLE, 2, 22],
          [ES_MISSLE, 37, 22],
        ],
      }),
    DOWN,
  ),
  // SHIP35: weaving wasp, aimed sting
  wasp: variants(
    (path) =>
      bug("BUG_WASP", 24, 32, {
        path,
        hits: 7,
        money: 600,
        movespeed: 4,
        exptype: EXP_AIRMED,
        shotspace: 5,
        shootcnt: 2,
        guns: [[ES_ATPLAYER, 12, 28]],
      }),
    null,
    [
      [0, -104],
      [24, -80],
      [24, -48],
      [-24, 0],
      [-24, 32],
      [0, 56],
      [0, 128],
    ],
  ),
  // SHIP34: drifting spore pod that homes in on the nearest ship
  spore: variants(
    (path) =>
      bug("BUG_SPORE", 32, 32, {
        path,
        flighttype: F_KAMI,
        hits: 10,
        money: 100,
        movespeed: 2,
        suck: 0,
        exptype: EXP_AIRSMALL2,
        frame_rate: 5,
        shootcnt: 0,
        shootframe: 0,
      }),
    [
      [-2, -106],
      [-2, -98],
    ],
  ),
  // SHIP37: dragonfly on a long looping path
  dragonfly: variants(
    (path) =>
      bug("BUG_DRAGONFLY", 24, 24, {
        path,
        hits: 18,
        money: 500,
        movespeed: 3,
        exptype: EXP_AIRMED,
        shootcnt: 3,
        shootframe: 18,
        guns: [[ES_ATPLAYER, 12, 20]],
      }),
    null,
    [
      [0, -104],
      [10, -88],
      [30, -78],
      [46, -70],
      [58, -50],
      [50, -28],
      [24, -16],
      [-2, -12],
      [-32, -8],
      [-54, 8],
      [-62, 28],
      [-56, 50],
      [-34, 70],
      [0, 76],
      [34, 86],
      [60, 112],
      [44, 136],
      [4, 146],
    ],
  ),
  // SHIP36: warden, a heavy escort with guns and missiles
  warden: variants(
    (path) =>
      bug("BUG_WARDEN", 32, 32, {
        path,
        hits: 11,
        money: 500,
        movespeed: 5,
        suck: 0,
        exptype: EXP_AIRMED,
        shootframe: 25,
        guns: [
          [ES_ATDOWN, 13, 28],
          [ES_ATDOWN, 19, 28],
          [ES_MISSLE, 5, 14],
          [ES_MISSLE, 27, 14],
        ],
      }),
    DOWN,
    [
      [0, -88],
      [48, -64],
      [72, -40],
      [72, 128],
    ],
  ),
  // SHIP26: lancer, a fast swoop with plasma bolts
  lancer: variants(
    (path) =>
      bug("BUG_LANCER", 24, 24, {
        path,
        hits: 8,
        money: 700,
        movespeed: 6,
        shootcnt: 2,
        shootframe: 15,
        guns: [[ES_PLASMA, 12, 20]],
      }),
    null,
    [
      [0, -88],
      [32, -16],
      [104, 58],
      [160, 96],
      [160, 128],
    ],
  ),
  // SHIP32: brood carrier, a slow armored gunship
  brood: variants(
    (path) =>
      bug("BUG_BROOD", 96, 64, {
        path,
        hits: 75,
        money: 700,
        movespeed: 2,
        suck: 0,
        exptype: EXP_AIRLARGE,
        shootcnt: 2,
        shootframe: 50,
        guns: [
          [ES_MISSLE, 46, 52],
          [ES_MISSLE, 49, 52],
          [ES_ANGLELEFT, 30, 56],
          [ES_ANGLERIGHT, 65, 56],
        ],
      }),
    [[0, 136]],
  ),
}

/** Ground units by kind. */
const GRD = {
  // TARGT1..5 / TARGT9/10: egg pod turret, aimed or angled acid
  pod: [
    bug("BUG_POD", 32, 32, {
      ...GROUND,
      hits: 40,
      money: 1000,
      shootcnt: 4,
      shootframe: 25,
      guns: [[ES_ATPLAYER, 16, 14]],
    }),
    bug("BUG_POD", 32, 32, {
      ...GROUND,
      hits: 30,
      money: 500,
      shootcnt: 3,
      shootframe: 25,
      guns: [[ES_ANGLERIGHT, 20, 14]],
    }),
    bug("BUG_POD", 32, 32, {
      ...GROUND,
      hits: 30,
      money: 500,
      shootcnt: 3,
      shootframe: 25,
      guns: [[ES_ANGLELEFT, 12, 14]],
    }),
  ],
  // TARGT7: acid spire, opens up (5 frames) before each missile pair
  spire: [
    bug("BUG_SPIRE", 32, 32, {
      ...GROUND,
      exptype: EXP_GRDLARGE,
      hits: 45,
      money: 1100,
      animtype: 1,
      frame_rate: 1,
      num_frames: 5,
      countdown: 25,
      shootcnt: 4,
      shootframe: 25,
      guns: [
        [ES_MISSLE, 12, 16],
        [ES_MISSLE, 20, 16],
      ],
    }),
  ],
  // TARGT8 + APE: maw lobbing acid blobs
  maw: [
    bug("BUG_MAW", 32, 32, {
      ...GROUND,
      exptype: EXP_GRDLARGE,
      hits: 55,
      money: 1500,
      shootcnt: 2,
      shootframe: 25,
      guns: [[ES_COCONUTS, 16, 18]],
    }),
  ],
  // SHIP07/08: crawlers walking across a resin bridge (right / left)
  crawler: [F_GROUNDRIGHT, F_GROUNDLEFT].map((flighttype) =>
    bug("BUG_CRAWLER", 40, 24, {
      ...GROUND,
      flighttype,
      shadow: 1,
      exptype: EXP_GRDLARGE,
      hits: 40,
      money: 600,
      num_frames: 4,
      rewind: 4,
      frame_rate: 1,
      shootcnt: 4,
      shootframe: 35,
      guns: [[ES_ATPLAYER, 20, 12]],
    }),
  ),
}

/** SHIP24: moth carrying a bonus (air) / BONUS1G1: egg cache (ground). */
const moth = (bonus: number) =>
  bug("BUG_MOTH", 24, 40, {
    path: DOWN,
    bonus,
    hits: 10,
    money: 0,
    exptype: EXP_AIRMED,
    shotspace: 2,
    shootcnt: 0,
    shootframe: 0,
    suck: 0,
  })
const cache = (bonus: number) =>
  bug("BUG_CACHE", 32, 32, {
    ...GROUND,
    bonus,
    hits: 20,
    money: 0,
    shotspace: 1,
    shootcnt: 0,
    shootframe: 0,
  })

// boss hover paths (DOS SHIP10/11/18/16 flight patterns)
const HOVER: Pt[] = [
  [0, -72],
  [64, -32],
  [64, -8],
  [8, 32],
  [-8, 32],
  [-64, -8],
  [-64, -32],
  [-4, -70],
]
const WEAVE: Pt[] = [
  [0, -40],
  [-48, 8],
  [48, 8],
  [-40, -80],
  [40, -80],
  [2, -42],
  [48, -64],
  [48, -24],
  [0, -40],
  [-48, -24],
  [-48, -64],
  [-4, -44],
]
const SWOOP: Pt[] = [
  [0, -72],
  [8, -64],
  [32, 16],
  [72, 0],
  [10, -64],
  [-8, -64],
  [-32, 16],
  [-72, 0],
  [-10, -64],
  [-40, -8],
  [0, 16],
  [40, -8],
  [12, -60],
]
const CROSS: Pt[] = [
  [0, -72],
  [-64, -8],
  [-24, -8],
  [0, -32],
  [24, -8],
  [64, -8],
  [4, -70],
  [2, -8],
]

const guardian = (hits: number, money: number, path: Pt[], song: number, extra: Gun[] = []) =>
  bug("BUG_GUARDIAN", 80, 40, {
    ...BOSS,
    path,
    hits,
    money,
    song,
    shootcnt: 12,
    shootframe: 40,
    guns: [[ES_ATPLAYER, 40, 34], [ES_MISSLE, 19, 28], [ES_MISSLE, 62, 28], ...extra],
  })
const broodmother = (hits: number, money: number, path: Pt[], shootframe: number) =>
  bug("BUG_BROODMOTHER", 80, 56, {
    ...BOSS,
    path,
    hits,
    money,
    song: 2,
    shootcnt: 9,
    shootframe,
    guns: [
      [ES_ATPLAYER, 21, 40],
      [ES_ATPLAYER, 59, 40],
      [ES_MISSLE, 24, 46],
      [ES_MISSLE, 32, 48],
      [ES_MISSLE, 48, 48],
      [ES_MISSLE, 56, 46],
      [ES_PLASMA, 40, 52],
    ],
  })
const hivelord = (hits: number, money: number, path: Pt[]) =>
  bug("BUG_HIVELORD", 104, 72, {
    ...BOSS,
    path,
    hits,
    money,
    song: 3,
    shootcnt: 8,
    shootframe: 40,
    guns: [
      [ES_ANGLELEFT, 43, 62],
      [ES_ANGLERIGHT, 61, 62],
      [ES_MISSLE, 20, 50],
      [ES_MISSLE, 26, 52],
      [ES_MISSLE, 78, 52],
      [ES_MISSLE, 84, 50],
      [ES_PLASMA, 8, 56],
      [ES_PLASMA, 96, 56],
      [ES_ATPLAYER, 36, 40],
      [ES_ATPLAYER, 68, 40],
    ],
  })
/** MOLE: burrows up out of the hive floor (9 frame emerge) and stays a ground target. */
const burrower = (hits: number, money: number) =>
  bug("BUG_BURROWER", 96, 96, {
    ...GROUND,
    bossflag: 1,
    song: 1,
    exptype: EXP_GRDLARGE,
    hits,
    money,
    animtype: 1,
    frame_rate: 1,
    num_frames: 9,
    countdown: 30,
    rewind: 2,
    shootcnt: 10,
    shootframe: 17,
    guns: [
      [ES_ATPLAYER, 48, 75],
      [ES_ATPLAYER, 80, 43],
      [ES_ATPLAYER, 48, 11],
      [ES_ATPLAYER, 16, 43],
      [ES_ANGLELEFT, 19, 60],
      [ES_ANGLERIGHT, 77, 60],
      [ES_COCONUTS, 30, 30],
      [ES_COCONUTS, 66, 30],
    ],
  })

const BOSSES = {
  guardian: guardian(300, 3000, HOVER, 0),
  broodmother: broodmother(350, 5500, SWOOP, 40),
  hivelord: hivelord(500, 6000, CROSS),
  guardian2: guardian(400, 4500, WEAVE, 1, [
    [ES_PLASMA, 8, 30],
    [ES_PLASMA, 72, 30],
  ]),
  burrower: burrower(600, 5000),
  broodmother2: broodmother(500, 5500, WEAVE, 30),
  hivelord2: hivelord(550, 6500, SWOOP),
  burrower2: burrower(700, 6000),
  // SHIP22: the hive queen, end of the sector
  queen: bug("BUG_QUEEN", 96, 72, {
    ...BOSS,
    path: [
      [0, 0],
      [48, -48],
      [0, -64],
      [-48, -48],
      [-2, -2],
      [16, -48],
      [0, -56],
      [-16, -48],
      [-2, -16],
    ],
    hits: 750,
    money: 225000,
    song: 3,
    num_frames: 6,
    rewind: 6,
    shootcnt: 8,
    shootframe: 40,
    guns: [
      [ES_MISSLE, 5, 39],
      [ES_MISSLE, 9, 39],
      [ES_MISSLE, 13, 39],
      [ES_MISSLE, 17, 39],
      [ES_MISSLE, 79, 39],
      [ES_MISSLE, 83, 39],
      [ES_MISSLE, 87, 39],
      [ES_MISSLE, 91, 39],
      [ES_ANGLELEFT, 40, 50],
      [ES_ANGLERIGHT, 56, 50],
      [ES_ATPLAYER, 48, 60],
      [ES_PLASMA, 28, 65],
      [ES_PLASMA, 68, 65],
    ],
  }),
}

const BONUS: number[] = [
  Obj.ENERGY,
  Obj.MEGA_BOMB,
  Obj.DUMB_MISSLE,
  Obj.AIR_MISSLE,
  Obj.GRD_MISSLE,
  Obj.ITEMBUY2,
  Obj.ITEMBUY3,
  Obj.ITEMBUY4,
]
const CARRIERS = { moth: BONUS.map(moth), cache: BONUS.map(cache) }
/**
 * Energy crystal twins (EXP_ENERGY: drops a 50 CR crystal) of the light air bugs. Bravo ties the
 * crystal to a few unit types; here every wave hands out its own share (`WaveSpec.crystals`).
 */
const CRYSTAL = new Map(
  (
    [
      "drone",
      "ling",
      "spitter",
      "mantis",
      "hornet",
      "stinger",
      "wasp",
      "dragonfly",
      "lancer",
    ] as const
  )
    .flatMap((k) => AIR[k])
    .map((e): [EnemyLib, EnemyLib] => [e, { ...e, exptype: EXP_ENERGY }]),
)

/** The nest enemy library: spawn records index it (`WaveMap.lib`). */
export const NEST_LIB: EnemyLib[] = [
  ...Object.values(AIR).flat(),
  ...CRYSTAL.values(),
  ...Object.values(GRD).flat(),
  ...CARRIERS.moth,
  ...CARRIERS.cache,
  ...Object.values(BOSSES),
]
const ID = new Map(NEST_LIB.map((e, i) => [e, i]))
const slib = (e: EnemyLib) => ID.get(e) ?? 0

type AirKind = keyof typeof AIR
type GrdKind = keyof typeof GRD

/** A bonus drop: item, carrier (moth in the air, else an egg cache on the ground), CSPRITE level. */
interface Drop {
  obj: number
  air: boolean
  level: number
}
const grd = (obj: number, level = 3): Drop => ({ obj, air: false, level })
const air = (obj: number, level = 3): Drop => ({ obj, air: true, level })

interface WaveSpec {
  /** air kinds (types new to the wave are picked twice as often, a kind listed twice too) */
  air: AirKind[]
  ground: GrdKind[]
  /** bonus drops in flight order, mostly ground caches like Bravo; level 4/5 = Veteran+/Elite */
  bonus: Drop[]
  /** air bugs that drop an energy crystal (Bravo: 14..107 per wave) */
  crystals: number
  boss: keyof typeof BOSSES
  /** air spawns per row */
  density: number
}

const WAVES: WaveSpec[] = [
  {
    air: ["drone", "ling", "spitter"],
    ground: ["pod"],
    bonus: [grd(Obj.ENERGY), grd(Obj.DUMB_MISSLE)],
    crystals: 40,
    boss: "guardian",
    density: 2.4,
  },
  {
    air: ["drone", "ling", "spitter", "mantis"],
    ground: ["pod", "crawler"],
    bonus: [grd(Obj.ENERGY), grd(Obj.ITEMBUY4)],
    crystals: 20,
    boss: "broodmother",
    density: 2.5,
  },
  {
    air: ["drone", "ling", "mantis", "hornet"],
    ground: ["pod", "crawler", "spire"],
    bonus: [grd(Obj.AIR_MISSLE), air(Obj.ENERGY)],
    crystals: 75,
    boss: "hivelord",
    density: 2.6,
  },
  {
    air: ["ling", "spitter", "hornet", "stinger"],
    ground: ["pod", "spire", "maw"],
    bonus: [grd(Obj.ENERGY), grd(Obj.ITEMBUY3), grd(Obj.MEGA_BOMB), air(Obj.ENERGY, 5)],
    crystals: 65,
    boss: "guardian2",
    density: 2.7,
  },
  {
    air: ["drone", "mantis", "stinger", "beetle", "wasp"],
    ground: ["pod", "crawler", "maw"],
    bonus: [grd(Obj.ENERGY, 4), grd(Obj.GRD_MISSLE), air(Obj.ITEMBUY4)],
    crystals: 100,
    boss: "burrower",
    density: 2.8,
  },
  {
    air: ["ling", "hornet", "wasp", "spore", "dragonfly"],
    ground: ["pod", "spire", "crawler"],
    bonus: [grd(Obj.MEGA_BOMB), air(Obj.DUMB_MISSLE), grd(Obj.ITEMBUY2, 4), grd(Obj.ENERGY, 5)],
    crystals: 85,
    boss: "broodmother2",
    density: 2.9,
  },
  {
    air: ["spitter", "beetle", "spore", "warden", "warden", "lancer"],
    ground: ["pod", "maw", "spire"],
    bonus: [air(Obj.MEGA_BOMB), grd(Obj.ITEMBUY4), grd(Obj.DUMB_MISSLE)],
    crystals: 50,
    boss: "hivelord2",
    density: 3,
  },
  {
    air: ["mantis", "stinger", "dragonfly", "beetle", "beetle", "lancer", "brood"],
    ground: ["pod", "crawler", "maw", "spire"],
    bonus: [grd(Obj.ENERGY), grd(Obj.MEGA_BOMB), grd(Obj.ITEMBUY3, 4), air(Obj.ENERGY, 5)],
    crystals: 40,
    boss: "burrower2",
    density: 3.3,
  },
  {
    air: ["hornet", "beetle", "beetle", "warden", "warden", "lancer", "brood", "brood", "wasp"],
    ground: ["pod", "spire", "maw", "crawler"],
    bonus: [
      grd(Obj.MEGA_BOMB),
      grd(Obj.ENERGY),
      air(Obj.AIR_MISSLE),
      grd(Obj.MEGA_BOMB),
      grd(Obj.ENERGY, 5),
    ],
    crystals: 30,
    boss: "queen",
    density: 3.5,
  },
]
export const NEST_WAVES = WAVES.length

/** Spawn record before linking: row, library entry, column, difficulty level, group id. */
interface Rec {
  row: number
  lib: EnemyLib
  x: number
  level: number
  group: number
}

/** Map rows the waves fly: first spawns at the bottom, the boss at the top. */
const FIRST_ROW = 139
const LAST_ROW = 10
const BOSS_ROW = 1

/** Variant for a column: center columns fly the straight path, the sides sweep inward. */
function pick(v: EnemyLib[], x: number): EnemyLib {
  if (v.length === 1) return v[0] as EnemyLib
  const side = v.length === 2 ? 0 : 1
  if (v.length === 3 && x >= 3 && x <= 5) return v[0] as EnemyLib
  return (x < 4 ? v[side] : v[side + 1]) as EnemyLib
}

class WaveBuilder {
  readonly recs: Rec[] = []
  /** map spots covered by ground units (the terrain keeps them solid, no structures) */
  readonly pads = new Set<number>()
  /** rows crossed by crawlers (the terrain bridges them) */
  readonly bridges = new Set<number>()
  private readonly r: Rng
  private group = 0

  private readonly spec: WaveSpec
  private readonly fresh: Set<AirKind>

  constructor(spec: WaveSpec, fresh: Set<AirKind>, seed: number) {
    this.spec = spec
    this.fresh = fresh
    this.r = new Rng(seed)
  }

  /** CSPRITE level: 3 = every difficulty, 4 = Veteran + Elite, 5 = Elite (Bravo mix ~42/27/31%). */
  private level(): number {
    const v = this.r.random(100)
    if (v < 42) return 3
    return v < 69 ? 4 : 5
  }

  /** Ground units: mostly every difficulty, like Bravo's turrets (~62/20/18%). */
  private groundLevel(): number {
    const v = this.r.random(100)
    if (v < 62) return 3
    return v < 82 ? 4 : 5
  }

  private add(row: number, lib: EnemyLib, x: number, level = this.level(), group = -1): void {
    this.recs.push({ row, lib, x, level, group })
  }

  /** `n` distinct columns. */
  private cols(n: number): number[] {
    const all = Array.from({ length: MAP_COLS }, (_, i) => i)
    for (let i = all.length - 1; i > 0; i--) {
      const j = this.r.random(i + 1)
      ;[all[i], all[j]] = [all[j] as number, all[i] as number]
    }
    return all.slice(0, n)
  }

  private airKind(): AirKind {
    const pool = this.spec.air.flatMap((k) => (this.fresh.has(k) ? [k, k] : [k]))
    return pool[this.r.random(pool.length)] as AirKind
  }

  /** Squadrons of one kind, 6..12 rows each, with a short pause between them. */
  air(): void {
    let row = FIRST_ROW
    while (row > LAST_ROW) {
      const kind = this.airKind()
      const heavy = kind === "brood" || kind === "beetle"
      const len = heavy ? 4 + this.r.random(3) : 6 + this.r.random(7)
      const end = Math.max(LAST_ROW, row - len)
      for (; row > end; row--) this.airRow(kind, row)
      row -= 1 + this.r.random(2)
    }
  }

  private airRow(kind: AirKind, row: number): void {
    const v = AIR[kind]
    if (kind === "brood") {
      // gunship: one every other row
      if (row % 2 === 0) for (const x of this.cols(1)) this.add(row, pick(v, x), x)
      return
    }
    if (kind === "beetle") {
      // armored squadron: 1..2 per row
      for (const x of this.cols(1 + this.r.random(2))) this.add(row, pick(v, x), x)
      return
    }
    if (kind === "ling") {
      // a linked pack on adjacent columns every other row
      if (row % 2) return
      const n = 3 + this.r.random(3)
      const x0 = this.r.random(MAP_COLS - n + 1)
      const level = this.level()
      const group = ++this.group
      for (let i = 0; i < n; i++) this.add(row, pick(v, x0 + i), x0 + i, level, group)
      return
    }
    const d = this.spec.density
    const n = Math.floor(d) + Number(this.r.random(100) < (d % 1) * 100)
    for (const x of this.cols(n)) this.add(row, pick(v, x), x)
  }

  /** A ground unit every 5..8 rows; crawlers enter from the screen edge on a bridge row. */
  ground(): void {
    for (let row = FIRST_ROW - 3; row > LAST_ROW + 2; row -= 5 + this.r.random(4)) {
      const kind = this.spec.ground[this.r.random(this.spec.ground.length)] as GrdKind
      if (kind === "crawler") {
        const left = this.r.random(2)
        const x = left ? MAP_COLS - 1 : 0
        this.add(row, GRD.crawler[left] as EnemyLib, x, this.groundLevel())
        this.bridges.add(row)
        continue
      }
      const v = GRD[kind]
      const x = this.r.random(MAP_COLS)
      this.add(row, v[this.r.random(v.length)] as EnemyLib, x, this.groundLevel())
      this.pads.add(row * MAP_COLS + x)
    }
  }

  /** Bonus carriers spread over the wave. */
  bonus(): void {
    const n = this.spec.bonus.length
    this.spec.bonus.forEach((d, i) => {
      const row = FIRST_ROW - 8 - Math.floor(((FIRST_ROW - 30) * i) / n)
      const k = BONUS.indexOf(d.obj)
      const x = 2 + this.r.random(5)
      if (d.air) this.add(row, CARRIERS.moth[k] as EnemyLib, x, d.level)
      else {
        this.add(row, CARRIERS.cache[k] as EnemyLib, x, d.level)
        this.pads.add(row * MAP_COLS + x)
      }
    })
  }

  /** `spec.crystals` random light air bugs turn into their energy crystal twins. */
  crystals(): void {
    const pool = this.recs.filter((s) => CRYSTAL.has(s.lib))
    for (let n = 0; n < this.spec.crystals && pool.length; n++) {
      const s = pool.splice(this.r.random(pool.length), 1)[0] as Rec
      s.lib = CRYSTAL.get(s.lib) as EnemyLib
    }
  }

  /** The boss is the last record; a burrowing boss needs a 3x3 pad. */
  boss(): void {
    const b = BOSSES[this.spec.boss]
    this.add(BOSS_ROW, b, 4, 3)
    if (b.flighttype !== F_GROUND) return
    for (let r = 0; r < 3; r++) for (let c = 3; c < 6; c++) this.pads.add(r * MAP_COLS + c)
  }

  /** CSPRITE records `[link, slib, x, y, game, level]`, rows descending, packs linked (0 .. 1). */
  spawns(): number[][] {
    const boss = this.recs.pop() as Rec
    const sorted = [...this.recs].sort((a, b) => b.row - a.row)
    sorted.push(boss)
    return sorted.map((s, i) => {
      const next = sorted[i + 1]
      let link = -1
      if (s.group >= 0) link = next?.group === s.group ? 0 : 1
      return [link, slib(s.lib), s.x, s.row, 0, s.level]
    })
  }
}

const maps: WaveMap[] = []

/** Wave `wave` (0-based) of the nest: built on first use, then cached. */
export function nestMap(wave: number): WaveMap | undefined {
  const spec = WAVES[wave]
  if (!spec || maps[wave]) return maps[wave]
  const known = new Set(WAVES.slice(0, wave).flatMap((s) => s.air))
  const fresh = new Set(spec.air.filter((k) => !known.has(k)))
  const b = new WaveBuilder(spec, fresh, 7919 * (wave + 1))
  b.air()
  b.crystals()
  b.ground()
  b.bonus()
  b.boss()
  maps[wave] = {
    spawns: b.spawns(),
    lib: NEST_LIB,
    ...hiveTerrain(101 + wave, b.pads, b.bridges, 60 + 12 * wave),
  }
  return maps[wave]
}
