// In-memory campaign state shared by the scenes (the saved copy lives in data/save.ts).

import type { Loadout } from "./campaign"
import { loadout, withLoadout } from "./campaign"
import { loadPilots, type PilotSave, savePilot } from "./data/save"

let pilot: PilotSave | null = null

export function currentPilot(): PilotSave | null {
  return pilot
}

export function setPilot(p: PilotSave, persist = true): void {
  pilot = p
  if (persist) savePilot(p)
}

/** Reload the last saved pilot (after a death). */
export function reloadPilot(): PilotSave | null {
  const name = pilot?.name
  pilot = loadPilots().find((p) => p.name === name) ?? null
  return pilot
}

/** Store the loadout in the current pilot and save it. */
export function saveLoadout(lo: Loadout): void {
  if (pilot) setPilot(withLoadout(pilot, lo))
}

export function pilotLoadout(): Loadout {
  if (!pilot) throw new Error("no pilot")
  return loadout(pilot)
}

/** Hidden god mode stays on for the following missions until switched off (not saved). */
let god = false

export function godMode(): boolean {
  return god
}

export function setGodMode(on: boolean): void {
  god = on
}
