/** One SPRITE1_ITM record (dosraptor/SOURCE/MAP.H SPRITE); w/h = size of its first frame. */
export interface EnemyLib {
  iname: string
  w: number
  h: number
  bonus: number
  exptype: number
  shotspace: number
  ground: number
  suck: number
  frame_rate: number
  num_frames: number
  countdown: number
  rewind: number
  animtype: number
  shadow: number
  bossflag: number
  hits: number
  money: number
  shootstart: number
  shootcnt: number
  shootframe: number
  movespeed: number
  numflight: number
  repos: number
  flighttype: number
  numguns: number
  numengs: number
  sfx: number
  song: number
  shoot_type: number[]
  engx: number[]
  engy: number[]
  englx: number[]
  shootx: number[]
  shooty: number[]
  flightx: number[]
  flighty: number[]
}

/** One wave's map: MAPS entry (tile FLATS indices + CSPRITE spawn records), plus web tweaks. */
export interface WaveMap {
  flats: number[]
  spawns: number[][]
  /** web: halve the boss hits and burst length (beginner training wave) */
  easyBoss?: boolean
}
