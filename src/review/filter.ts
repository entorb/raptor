// Sector / wave filter at the top of the review pages. Empty = unfiltered.
import { MAPS } from "../game/data/ep1"
import { DIFF_TRAIN, DIFF_WRAP } from "../game/sim/consts"

export interface Filter {
  sector: "" | "bravo" | "train"
  /** 0-based wave as a string, "" = all */
  wave: string
}

const TRAIN_WAVES = DIFF_WRAP[DIFF_TRAIN] ?? 4

/** Wave (0-based) is shown by the filter: training flies only the first waves. */
export function waveVisible(f: Filter, wave: number): boolean {
  return (f.wave === "" || Number(f.wave) === wave) && (f.sector !== "train" || wave < TRAIN_WAVES)
}

/** Adds the two selects before #nav; `apply` runs now and on every change. */
export function initFilter(apply: (f: Filter) => void): () => void {
  const box = document.createElement("div")
  box.className = "filter"
  const select = (label: string, options: [string, string][]) => {
    const l = document.createElement("label")
    const s = document.createElement("select")
    for (const [value, text] of [["", ""], ...options]) s.add(new Option(text, value))
    l.append(label, s)
    box.append(l)
    return s
  }
  const sector = select("Sector", [
    ["train", "Training"],
    ["bravo", "Bravo"],
  ])
  const wave = select(
    "Wave",
    MAPS.map((_, w) => [String(w), String(w + 1)]),
  )
  document.getElementById("nav")?.before(box)
  const run = () => {
    const f: Filter = { sector: sector.value as Filter["sector"], wave: wave.value }
    // only the sector's waves are selectable; an out-of-range wave falls back to all
    for (const o of wave.options)
      o.hidden = o.disabled = o.value !== "" && !waveVisible({ ...f, wave: "" }, Number(o.value))
    if (wave.selectedOptions[0]?.disabled) f.wave = wave.value = ""
    apply(f)
  }
  sector.addEventListener("change", run)
  wave.addEventListener("change", run)
  run()
  return run
}
