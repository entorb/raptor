// Render a DMX .MUS song with its GENMIDI.OP2 bank through the vendored OPL3 emulator.
// DMX plays MUS at 140 Hz ticks (apodmx/DMX.C), which the vendored MUS driver also uses.
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const OPL3 = require("../vendor/opl3/opl3.cjs")
const MUS = require("../vendor/opl3/mus.cjs")

const RATE = 49716 // native OPL3 sample rate (the emulator produces one sample per call)

/** Returns interleaved stereo 16-bit PCM (peak-normalized) as a Buffer. */
export function renderMus(musBuf, genmidiBuf) {
  const player = new MUS(new OPL3(), { instruments: new Uint8Array(genmidiBuf).buffer })
  player.load(new Uint8Array(musBuf).buffer)
  const chunks = []
  let total = 0
  while (player.update()) {
    const n = Math.floor(RATE * player.refresh())
    if (n <= 0) continue
    const f = new Float32Array(n * 2)
    player.opl.read(f)
    chunks.push(f)
    total += f.length
  }
  let peak = 1e-6
  for (const c of chunks) for (const v of c) peak = Math.max(peak, Math.abs(v))
  const gain = 0.9 / peak
  const pcm = Buffer.alloc(total * 2)
  let o = 0
  for (const c of chunks)
    for (const v of c) {
      pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * gain * 32767))), o)
      o += 2
    }
  return { pcm, rate: RATE }
}
