// Server-side mission counter, shared with the other entorb.net pages.
const STATS_URL = "https://entorb.net/web-stats-json.php?origin=raptor"

export function parseAccessCounts(data: unknown): number | null {
  if (typeof data !== "object" || data === null) return null
  const value = (data as Record<string, unknown>).accesscounts
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export async function readGlobalMissions(): Promise<number | null> {
  try {
    const response = await fetch(`${STATS_URL}&action=read`)
    if (!response.ok) return null
    return parseAccessCounts(await response.json())
  } catch {
    return null
  }
}

export function reportMissionStart(): void {
  // dev server and local preview must not raise the live counter
  const host = globalThis.location?.hostname ?? ""
  if (import.meta.env.DEV || host === "localhost" || host === "127.0.0.1") return
  // `globalThis.fetch` may be missing in some environments (tests); the
  // optional call short-circuits, and `.catch` swallows network rejections.
  void globalThis.fetch?.(`${STATS_URL}&action=write`).catch(() => {})
}

export function runStatsSelfCheck(): void {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`selfcheck: ${msg}`)
  }

  assert(parseAccessCounts({ accesscounts: 7 }) === 7, "reads count")
  assert(parseAccessCounts({ accesscounts: 0 }) === 0, "reads zero")
  assert(parseAccessCounts({ accesscounts: "7" }) === null, "rejects string")
  assert(parseAccessCounts({ accesscounts: Number.NaN }) === null, "rejects NaN")
  assert(parseAccessCounts({}) === null, "rejects missing field")
  assert(parseAccessCounts(null) === null, "rejects null")
  assert(parseAccessCounts("nope") === null, "rejects string body")
}
