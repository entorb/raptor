// Port of the between-waves logic of dosraptor/SOURCE/WINDOWS.C WIN_MainLoop (pure, testable).
import { MAPS } from "./data/ep1"
import type { LevelStats, PilotSave, Sector, TopRun } from "./data/save"
import { BEGINNER_MAP } from "./data/training"
import type { WaveMap } from "./data/types"
import { t } from "./i18n/i18n"
import { DIFF_TRAIN, DIFF_WRAP, MAX_SHIELD, Obj } from "./sim/consts"
import { Inventory, newPilotObjs } from "./sim/objects"

export interface Loadout {
  plr: { score: number; sweapon: number }
  inv: Inventory
}

/** Build the runtime inventory for a saved pilot (fresh pilots get the starting loadout). */
export function loadout(p: PilotSave): Loadout {
  const plr = { score: p.score, sweapon: p.sweapon }
  const inv = new Inventory(plr)
  if (p.objs.length) inv.load(p.objs)
  else newPilotObjs(inv)
  return { plr, inv }
}

export function withLoadout(p: PilotSave, l: Loadout): PilotSave {
  return { ...p, score: l.plr.score, sweapon: l.plr.sweapon, objs: l.inv.save() }
}

// web: training opens with the beginner wave, then flies the DOS training maps 0..3
const TRAIN_WAVES = (DIFF_WRAP[DIFF_TRAIN] ?? 4) + 1
const TOP = 10

/** Waves in this difficulty's campaign. */
export function wavesFor(diff: number): number {
  return DIFF_WRAP[diff] ?? 9
}

export function sectorWaves(p: PilotSave, sector: Sector): number {
  return sector === "train" ? TRAIN_WAVES : wavesFor(p.diff)
}

/** Difficulty the sim runs with: training always flies DIFF_TRAIN. */
export function sectorDiff(p: PilotSave, sector: Sector): number {
  return sector === "train" ? DIFF_TRAIN : p.diff
}

/** DOS map (index = sim seed / terrain / song) a sector wave flies. */
export function waveMap(sector: Sector, wave: number): { index: number; map: WaveMap | undefined } {
  if (sector === "bravo") return { index: wave, map: MAPS[wave] }
  if (wave === 0) return { index: 0, map: BEGINNER_MAP }
  return { index: wave - 1, map: MAPS[wave - 1] }
}

/** Next campaign wave of a sector, null when the sector is finished. */
export function nextWave(p: PilotSave, sector: Sector): number | null {
  const w = sector === "bravo" ? p.wave : (p.train ?? 0)
  return w < sectorWaves(p, sector) ? w : null
}

/** Waves this pilot has finished at least once in a sector (replayable). */
export function doneWaves(p: PilotSave, sector: Sector): number {
  return sector === "train" ? (p.train ?? 0) : (p.done ?? 0)
}

/** Wave preselected in the Hangar: the next unfinished one, else the sector's last. */
export function defaultWave(p: PilotSave, sector: Sector): number {
  return nextWave(p, sector) ?? sectorWaves(p, sector) - 1
}

/** A wave can be flown once finished (replay) or when it is the next campaign wave. */
export function playable(p: PilotSave, sector: Sector, w: number): boolean {
  return w < doneWaves(p, sector) || w === nextWave(p, sector)
}

export const levelKey = (sector: Sector, wave: number) => `${sector === "train" ? "t" : "b"}${wave}`

/** Stats of one level (empty when never flown). */
export const levelStats = (p: PilotSave, key: string): LevelStats =>
  p.stats?.[key] ?? { n: 0, top: [] }

/** "Wave n: flown / won" header of a level's top-10 table. */
export function topHeader(st: LevelStats | undefined, wave: number): string {
  return t("hangar.topLine", { wave: wave + 1, flown: st?.s ?? st?.n ?? 0, won: st?.n ?? 0 })
}

/** A wave other than the next campaign wave is a replay. */
export const isReplay = (p: PilotSave, sector: Sector, wave: number) => wave !== nextWave(p, sector)

/** Count a finished run and keep the level's top-10 runs by earnings; rank is 1-based or null. */
export function recordRun(
  p: PilotSave,
  key: string,
  earned: number,
  pct?: number,
): { pilot: PilotSave; rank: number | null } {
  const old = levelStats(p, key)
  const run: TopRun = pct === undefined ? { cr: earned } : { cr: earned, pct }
  // stable sort: on ties the new run ranks below equal older runs
  const top = [...old.top, run].sort((a, b) => b.cr - a.cr).slice(0, TOP)
  const idx = top.indexOf(run)
  const rank = idx < 0 ? null : idx + 1
  return { pilot: { ...p, stats: { ...p.stats, [key]: { n: old.n + 1, top } } }, rank }
}

/** Count a mission start on this level (wins, deaths and aborts all count as a start). */
export const recordStart = (p: PilotSave, key: string) => bumpStat(p, key, "s")

/** Count a death on this level (kept even though the loadout/score of the run is discarded). */
export const recordFail = (p: PilotSave, key: string) => bumpStat(p, key, "f")

function bumpStat(p: PilotSave, key: string, field: "s" | "f"): PilotSave {
  const old = levelStats(p, key)
  return { ...p, stats: { ...p.stats, [key]: { ...old, [field]: (old[field] ?? 0) + 1 } } }
}

/** Web change: a completed wave refills the shield to at least 50%. */
export function refillShield(inv: Inventory): void {
  const shield = inv.p_objs[Obj.ENERGY]
  if (shield) shield.num = Math.max(shield.num, MAX_SHIELD / 2)
}

/** Hangar/shop status line: credits, shield, phase shields and nova bombs. */
export function statusLine(inv: Inventory, cr: number): string {
  const shield = Math.round((inv.getAmt(Obj.ENERGY) / MAX_SHIELD) * 100)
  const phase = inv.getAmt(Obj.SUPER_SHIELD)
  const phaseStr = phase ? `   ${t("hud.phase")} ${phase}% x${inv.getTotal(Obj.SUPER_SHIELD)}` : ""
  return `${t("hud.credits")} ${cr}   ${t("hud.shield")} ${shield}%${phaseStr}   ${t("hud.nova")} ${inv.getAmt(Obj.MEGA_BOMB)}`
}

/** One top-10 row: rank, credits and enemy kill percent (`-` for runs without it). */
export function topRunLine(i: number, r: TopRun): string {
  const pct = r.pct === undefined ? "-" : `${r.pct}%`
  return `${String(i + 1).padStart(2)}.  ${String(r.cr).padStart(8)} CR  ${pct.padStart(4)} ${t("kills")}`
}

export type WaveResult = "complete" | "dead" | "abort"
export type Outcome = "landing" | "death" | "trainingComplete" | "episodeComplete"

/**
 * WIN_MainLoop after Do_Game. `p` already holds the post-flight score/inventory (for an abort the
 * caller restores the start score, as Do_Game does). Death returns the pilot unchanged: the web
 * version reloads the last save (DOS returns to the main menu without saving).
 * Web changes: training is a sector of every pilot, the difficulty stays fixed per pilot, and
 * `wave` != `nextWave` is a replay (credits and loadout kept, the campaign stays put).
 */
export function afterWave(
  p: PilotSave,
  result: WaveResult,
  sector: Sector = "bravo",
  wave = nextWave(p, sector) ?? 0,
  earned = 0,
  pct?: number,
): { pilot: PilotSave; outcome: Outcome; rank: number | null } {
  if (result === "dead") return { pilot: p, outcome: "death", rank: null }
  if (result === "abort") return { pilot: p, outcome: "landing", rank: null }
  const run = recordRun(p, levelKey(sector, wave), earned, pct)
  const { rank } = run
  // finished the last training wave (first time or replay): the Hangar now defaults to Bravo
  const pilot: PilotSave =
    sector === "train" && wave === TRAIN_WAVES - 1 ? { ...run.pilot, sector: "bravo" } : run.pilot
  if (isReplay(p, sector, wave)) return { pilot, outcome: "landing", rank }
  if (sector === "train") {
    const train = wave + 1
    return {
      pilot: { ...pilot, train },
      outcome: train === TRAIN_WAVES ? "trainingComplete" : "landing",
      rank,
    }
  }
  // episode end: DOS raises the difficulty and restarts; here the difficulty stays fixed and
  // the finished sector stays open for replays
  const wave1 = p.wave + 1
  return {
    pilot: { ...pilot, wave: wave1, done: Math.max(p.done ?? 0, wave1) },
    outcome: wave1 === wavesFor(p.diff) ? "episodeComplete" : "landing",
    rank,
  }
}

export function runCampaignSelfCheck(): void {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error(`selfcheck: ${m}`)
  }
  const base: PilotSave = {
    name: "T",
    score: 0,
    sweapon: -1,
    wave: 0,
    diff: 2,
    objs: [],
  }
  const l = loadout(base)
  assert(l.plr.score === 10000 && l.inv.getAmt(Obj.ENERGY) === 75, "new pilot loadout")
  assert(afterWave(base, "complete").pilot.wave === 1, "wave advances")
  assert(afterWave({ ...base, wave: 3 }, "complete").pilot.done === 4, "done tracks finished waves")
  const replay = afterWave({ ...base, wave: 8, done: 9 }, "complete", "bravo", 2, 500)
  assert(replay.outcome === "landing" && replay.pilot.wave === 8, "replay keeps campaign wave")
  assert(replay.pilot.stats?.b2?.n === 1 && replay.rank === 1, "replay is recorded")
  assert(afterWave(base, "abort").pilot.wave === 0, "abort keeps wave")
  const last = afterWave({ ...base, wave: 8 }, "complete")
  assert(
    last.outcome === "episodeComplete" &&
      last.pilot.diff === 2 &&
      nextWave(last.pilot, "bravo") === null &&
      doneWaves(last.pilot, "bravo") === 9,
    "episode end keeps difficulty, sector finished",
  )
  const t1 = afterWave(base, "complete", "train")
  assert(t1.pilot.train === 1 && t1.pilot.wave === 0, "training advances separately")
  const t4 = afterWave({ ...base, train: 3 }, "complete", "train")
  assert(t4.outcome === "landing" && nextWave(t4.pilot, "train") === 4, "training has 5 waves")
  const t5 = afterWave({ ...base, train: 4 }, "complete", "train")
  assert(t5.outcome === "trainingComplete" && nextWave(t5.pilot, "train") === null, "training end")
  assert(t5.pilot.sector === "bravo" && t4.pilot.sector === base.sector, "training end -> bravo")
  const t5r = afterWave({ ...t5.pilot, sector: "train" }, "complete", "train", 4)
  assert(t5r.pilot.sector === "bravo", "training last-wave replay -> bravo")
  assert(defaultWave(base, "train") === 0 && defaultWave(t5.pilot, "train") === 4, "default wave")
  assert(playable(t4.pilot, "train", 4) && !playable(base, "train", 1), "playable waves")
  assert(waveMap("train", 0).map === BEGINNER_MAP, "training starts with the beginner wave")
  assert(waveMap("train", 4).index === 3 && waveMap("bravo", 4).index === 4, "wave -> DOS map")
  let q = base
  for (let i = 1; i <= 12; i++) q = recordRun(q, "b0", i * 100).pilot
  const r = recordRun(q, "b0", 450)
  assert(r.rank === 9 && r.pilot.stats?.b0?.top.length === 10, "top 10 rank")
  assert(recordRun(q, "b0", 100).rank === null, "below top 10")
  assert(recordRun(q, "b0", 1300, 87).pilot.stats?.b0?.top[0]?.pct === 87, "stores enemy percent")
  assert(recordFail(recordFail(base, "b0"), "b0").stats?.b0?.f === 2, "counts deaths")
  assert(recordStart(recordStart(base, "b0"), "b0").stats?.b0?.s === 2, "counts starts")
}
