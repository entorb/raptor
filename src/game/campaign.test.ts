import { expect, it } from "vitest"
import { runCampaignSelfCheck } from "./campaign"
import { isPilotSave, newPilotSave } from "./data/save"

it("campaign self-check", () => {
  expect(() => runCampaignSelfCheck()).not.toThrow()
})

it("rejects malformed saves (localStorage is untrusted)", () => {
  expect(isPilotSave(newPilotSave("P"))).toBe(true)
  expect(isPilotSave(null)).toBe(false)
  expect(isPilotSave({ name: "x", score: "1", wave: 0, diff: 2, objs: [] })).toBe(false)
  expect(isPilotSave({ ...newPilotSave("P"), objs: [{ type: "a", num: 1 }] })).toBe(false)
})
