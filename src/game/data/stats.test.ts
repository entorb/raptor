import { describe, expect, it } from "vitest"
import { parseAccessCounts, runStatsSelfCheck } from "./stats"

describe("parseAccessCounts", () => {
  it("reads the accesscounts field", () => {
    expect(parseAccessCounts({ accesscounts: 7 })).toBe(7)
    expect(parseAccessCounts({ accesscounts: 0 })).toBe(0)
  })

  it("rejects malformed payloads", () => {
    expect(parseAccessCounts({ accesscounts: "7" })).toBeNull()
    expect(parseAccessCounts({ accesscounts: Number.NaN })).toBeNull()
    expect(parseAccessCounts({})).toBeNull()
    expect(parseAccessCounts(null)).toBeNull()
    expect(parseAccessCounts("nope")).toBeNull()
  })

  it("passes its self-check", () => {
    expect(() => runStatsSelfCheck()).not.toThrow()
  })
})
