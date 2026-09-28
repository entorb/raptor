// Pilot + settings persistence (replaces LOADSAVE.C CHARxxxx.FIL files).
import { DIFF_EASY, DIFF_NORMAL, DIFF_TRAIN } from "../sim/consts"
import type { InvObj } from "../sim/objects"

export interface PilotSave {
  name: string
  score: number
  sweapon: number
  /** 0-based next wave of the Bravo sector (game_wave[0]) */
  wave: number
  /** Bravo sector difficulty (DIFF_EASY..DIFF_HARD) */
  diff: number
  objs: InvObj[]
  /** Bravo waves ever finished (unlocks replays); missing in old saves = `wave` */
  done?: number
  /** sector selected in the Hangar */
  sector?: Sector
  /** training waves finished (the training sector has 4) */
  train?: number
  /** per level (`b<wave>`, `t<wave>`): completions and top-10 runs by earnings (descending) */
  stats?: Record<string, LevelStats>
}

/** Sectors in Hangar toggle order (a new sector also needs SECTOR_NAMES and its waves). */
export const SECTORS = ["train", "bravo"] as const
export type Sector = (typeof SECTORS)[number]

export interface LevelStats {
  n: number
  /** mission starts on this level, wins + fails + aborts (missing in old saves) */
  s?: number
  /** deaths on this level (missing in old saves) */
  f?: number
  top: TopRun[]
}

/** A top-10 run: credits earned and percent of enemies destroyed (missing in old saves). */
export interface TopRun {
  cr: number
  pct?: number
}

export interface Settings {
  music: number
  sfx: number
  /** fire continuously without holding a button (default on) */
  autoFire: boolean
}

// TODO: delete after 1.10.2026 (single-pilot save migration)
const OLD_PILOT_KEY = "raptor.pilot.v1"
const PILOTS_KEY = "raptor.pilots.v1"
export const MAX_NAME = 16
const SETTINGS_KEY = "raptor.settings.v1"

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or blocked (private mode): progress is kept for this session only
  }
}

export function isPilotSave(v: unknown): v is PilotSave {
  const p = v as PilotSave
  return (
    typeof p === "object" &&
    p !== null &&
    typeof p.name === "string" &&
    Number.isInteger(p.score) &&
    Number.isInteger(p.wave) &&
    Number.isInteger(p.diff) &&
    (p.done === undefined || Number.isInteger(p.done)) &&
    (p.train === undefined || Number.isInteger(p.train)) &&
    Array.isArray(p.objs) &&
    p.objs.every((o) => Number.isInteger(o.type) && Number.isInteger(o.num))
  )
}

/** All saved pilots, most recently saved first (`[0]` = Continue). */
export function loadPilots(): PilotSave[] {
  const old = read<unknown>(OLD_PILOT_KEY)
  if (old !== null) {
    // one-time migration of the single-pilot save
    // TODO: delete after 1.10.2026
    remove(OLD_PILOT_KEY)
    if (isPilotSave(old)) savePilot(old)
  }
  const list = read<unknown>(PILOTS_KEY)
  return Array.isArray(list) ? list.filter(isPilotSave).map(normalize) : []
}

const isStats = (v: unknown): v is LevelStats => {
  const s = v as LevelStats
  return typeof s === "object" && s !== null && Number.isInteger(s.n) && Array.isArray(s.top)
}

/** Old saves stored plain credits; drop malformed entries. */
function topRuns(top: unknown[]): TopRun[] {
  return top.flatMap((v) => {
    // TODO: delete after 1.10.2026 (migration of plain-credit top-10 entries)
    if (Number.isInteger(v)) return [{ cr: v as number }]
    const r = v as TopRun
    if (typeof r !== "object" || r === null || !Number.isInteger(r.cr)) return []
    return [Number.isInteger(r.pct) ? { cr: r.cr, pct: r.pct } : { cr: r.cr }]
  })
}

/** Fill defaults, drop untrusted junk and migrate old training pilots (diff 0) to Rookie. */
function normalize(p: PilotSave): PilotSave {
  const stats = Object.fromEntries(
    Object.entries(typeof p.stats === "object" && p.stats ? p.stats : {})
      .filter(([, v]) => isStats(v))
      .map(([k, v]) => [
        k,
        {
          n: v.n,
          top: topRuns(v.top),
          ...(Number.isInteger(v.s) ? { s: v.s } : {}),
          ...(Number.isInteger(v.f) ? { f: v.f } : {}),
        },
      ]),
  )
  const q: PilotSave = {
    ...p,
    sector: SECTORS.includes(p.sector as Sector) ? p.sector : "bravo",
    stats,
  }
  // TODO: delete after 1.10.2026 (old training pilots migration)
  if (p.diff <= DIFF_TRAIN) return { ...q, diff: DIFF_EASY, wave: 0, done: 0, train: p.wave }
  return { ...q, train: q.train ?? 0 }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function pilotNameTaken(name: string): boolean {
  return loadPilots().some((p) => sameName(p.name, name))
}

export function savePilot(p: PilotSave): void {
  write(PILOTS_KEY, [p, ...loadPilots().filter((q) => !sameName(q.name, p.name))])
}

export function deletePilot(name: string): void {
  write(
    PILOTS_KEY,
    loadPilots().filter((p) => !sameName(p.name, name)),
  )
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function loadSettings(): Settings {
  const s = read<Partial<Settings>>(SETTINGS_KEY) ?? {}
  const vol = (v: unknown, d: number) => (typeof v === "number" && v >= 0 && v <= 1 ? v : d)
  return {
    music: vol(s.music, 0.6),
    sfx: vol(s.sfx, 0.8),
    autoFire: typeof s.autoFire === "boolean" ? s.autoFire : true,
  }
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s)
}

export function newPilotSave(name: string, diff = DIFF_NORMAL): PilotSave {
  return {
    name,
    score: 0,
    sweapon: -1,
    wave: 0,
    diff,
    objs: [],
    sector: "train",
    train: 0,
    stats: {},
  }
}
