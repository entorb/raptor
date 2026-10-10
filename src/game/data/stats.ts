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

const PENDING_KEY = "raptor.statsPending"

export function parsePending(raw: string | null): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : 0
}

function loadPending(): number {
  try {
    return parsePending(localStorage.getItem(PENDING_KEY))
  } catch {
    return 0
  }
}

function savePending(n: number): void {
  try {
    if (n > 0) localStorage.setItem(PENDING_KEY, String(n))
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    // storage full or unavailable: nothing to do
  }
}

async function sendWrite(): Promise<boolean> {
  try {
    // `globalThis.fetch` may be missing in some environments (tests)
    return (await globalThis.fetch?.(`${STATS_URL}&action=write`))?.ok === true
  } catch {
    return false
  }
}

// Offline writes are counted in localStorage and sent after the next successful write.
async function writeMission(): Promise<void> {
  if (!(await sendWrite())) {
    savePending(loadPending() + 1)
    return
  }
  let left = loadPending()
  while (left > 0 && (await sendWrite())) left--
  savePending(left)
}

export function reportMissionStart(): void {
  // dev server and local preview must not raise the live counter
  const host = globalThis.location?.hostname ?? ""
  if (import.meta.env.DEV || host === "localhost" || host === "127.0.0.1") return
  void writeMission()
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
  assert(parsePending("3") === 3, "reads pending")
  assert(parsePending(null) === 0, "null pending")
  assert(parsePending("-1") === 0, "rejects negative pending")
  assert(parsePending("x") === 0, "rejects junk pending")
}
