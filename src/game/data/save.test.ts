import { beforeEach, expect, it } from "vitest"
import { deletePilot, loadPilots, newPilotSave, pilotNameTaken, savePilot } from "./save"

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage
})

it("migrates the old single-pilot save", () => {
  store.set("raptor.pilot.v1", JSON.stringify(newPilotSave("Old")))
  expect(loadPilots().map((p) => p.name)).toEqual(["Old"])
  expect(store.has("raptor.pilot.v1")).toBe(false)
})

it("keeps pilots unique by name, last saved first", () => {
  savePilot(newPilotSave("Ann"))
  savePilot(newPilotSave("Bob"))
  savePilot({ ...newPilotSave("ann"), score: 5 })
  expect(loadPilots().map((p) => [p.name, p.score])).toEqual([
    ["ann", 5],
    ["Bob", 0],
  ])
  expect(pilotNameTaken(" BOB ")).toBe(true)
  deletePilot("Bob")
  expect(pilotNameTaken("Bob")).toBe(false)
})

it("drops invalid entries (localStorage is untrusted)", () => {
  store.set("raptor.pilots.v1", JSON.stringify([newPilotSave("A"), { name: 1 }, null]))
  expect(loadPilots().map((p) => p.name)).toEqual(["A"])
  store.set("raptor.pilots.v1", "{}")
  expect(loadPilots()).toEqual([])
})

it("moves old training pilots (diff 0) to Rookie, keeping their training progress", () => {
  const old = {
    ...newPilotSave("T", 0),
    wave: 2,
    sector: "bravo" as const,
    stats: { b0: { n: "x", top: [] } },
  }
  store.set("raptor.pilots.v1", JSON.stringify([old]))
  const [p] = loadPilots()
  expect([p?.diff, p?.wave, p?.train, p?.sector, p?.stats]).toEqual([1, 0, 2, "bravo", {}])
})
