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

it("drops malformed stats and top-10 runs", () => {
  const top = [{ cr: 500, pct: 80 }, { cr: "x" }, { cr: 100, pct: "y" }]
  const stats = { b0: { n: 3, top }, b1: { n: "x", top: [] } }
  store.set("raptor.pilots.v1", JSON.stringify([{ ...newPilotSave("A"), stats }]))
  expect(loadPilots()[0]?.stats).toEqual({ b0: { n: 3, top: [{ cr: 500, pct: 80 }, { cr: 100 }] } })
})
