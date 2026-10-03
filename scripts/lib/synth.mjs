// Tiny offline synthesizer for scripts/gen_audio.mjs: oscillators, filters, envelopes, effects.
// Everything works on Float32Array buffers at SR; all randomness is seeded (reproducible output).

export const SR = 44100

/** Seeded PRNG (mulberry32), returns 0..1. */
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const mtof = (m) => 440 * 2 ** ((m - 69) / 12)
export const secs = (n) => Math.round(n * SR)

// ---- oscillators (phase 0..1, dt = f / SR) -----------------------------------------------------
function blep(t, dt) {
  if (t < dt) {
    const x = t / dt
    return x + x - x * x - 1
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt
    return x * x + x + x + 1
  }
  return 0
}

/** Band-limited oscillator; `freq(t)` may change over time. */
export class Osc {
  constructor(shape = "saw", phase = 0) {
    this.shape = shape
    this.p = phase
  }

  next(f, pw = 0.5) {
    const dt = Math.min(0.5, Math.abs(f) / SR)
    const p = this.p
    let v
    switch (this.shape) {
      case "sine":
        v = Math.sin(2 * Math.PI * p)
        break
      case "tri":
        v = 1 - 4 * Math.abs(p - 0.5)
        break
      case "square":
        v = (p < pw ? 1 : -1) + blep(p, dt) - blep((p + 1 - pw) % 1, dt)
        break
      default:
        v = 2 * p - 1 - blep(p, dt)
    }
    this.p = (p + dt) % 1
    return v
  }
}

// ---- filters -----------------------------------------------------------------------------------
/** RBJ biquad; call set() whenever cutoff changes (cheap enough per sample for short notes). */
export class Biquad {
  constructor(type = "lp", freq = 1000, q = Math.SQRT1_2) {
    this.type = type
    this.x1 = this.x2 = this.y1 = this.y2 = 0
    this.set(freq, q)
  }

  set(freq, q = this.q) {
    this.q = q
    const w = (2 * Math.PI * Math.max(10, Math.min(freq, SR * 0.45))) / SR
    const cos = Math.cos(w)
    const alpha = Math.sin(w) / (2 * q)
    let b0
    let b1
    let b2
    if (this.type === "hp") {
      b0 = (1 + cos) / 2
      b1 = -(1 + cos)
      b2 = b0
    } else if (this.type === "bp") {
      b0 = alpha
      b1 = 0
      b2 = -alpha
    } else {
      b0 = (1 - cos) / 2
      b1 = 1 - cos
      b2 = b0
    }
    const a0 = 1 + alpha
    this.b0 = b0 / a0
    this.b1 = b1 / a0
    this.b2 = b2 / a0
    this.a1 = (-2 * cos) / a0
    this.a2 = (1 - alpha) / a0
    return this
  }

  run(x) {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

// ---- envelopes ---------------------------------------------------------------------------------
/** Linear attack, exponential-ish decay to sustain, linear release after `dur` seconds. */
export function adsr(t, dur, a, d, s, r) {
  let v
  if (t < a) v = t / a
  else v = s + (1 - s) * Math.exp(-(t - a) / Math.max(1e-4, d))
  if (t > dur) v *= Math.max(0, 1 - (t - dur) / r)
  return v
}

// ---- buffers -----------------------------------------------------------------------------------
/** Render `len` seconds of fn(t, i) into a new buffer. */
export function render(len, fn) {
  const n = secs(len)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i)
  return out
}

/** Add `src` into `dst` at sample offset with gain. */
export function mixInto(dst, src, at, gain = 1) {
  const end = Math.min(dst.length, at + src.length)
  for (let i = Math.max(0, at); i < end; i++) dst[i] += src[i - at] * gain
}

export function normalize(bufs, peak = 0.9) {
  let m = 1e-9
  for (const b of bufs) for (const v of b) m = Math.max(m, Math.abs(v))
  for (const b of bufs) for (let i = 0; i < b.length; i++) b[i] *= peak / m
}

export function softClip(buf, drive = 1) {
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * drive)
}

/** Short fade in/out against clicks. */
export function fadeEdges(buf, inS = 0.002, outS = 0.01) {
  const a = secs(inS)
  const b = secs(outS)
  for (let i = 0; i < a && i < buf.length; i++) buf[i] *= i / a
  for (let i = 0; i < b && i < buf.length; i++) buf[buf.length - 1 - i] *= i / b
}

// ---- effects -----------------------------------------------------------------------------------
/** Freeverb-style reverb: mono send -> stereo wet. */
export function reverb(send, { room = 0.84, damp = 0.3, spread = 23 } = {}) {
  const k = SR / 44100
  const combs = [1116, 1188, 1277, 1356, 1422, 1491]
  const aps = [556, 441, 341]
  const chan = (off) => {
    const out = new Float32Array(send.length)
    for (const c of combs) {
      const len = Math.round((c + off) * k)
      const buf = new Float32Array(len)
      let idx = 0
      let store = 0
      for (let i = 0; i < send.length; i++) {
        const y = buf[idx]
        store = y * (1 - damp) + store * damp
        buf[idx] = send[i] + store * room
        idx = (idx + 1) % len
        out[i] += y
      }
    }
    for (const a of aps) {
      const len = Math.round((a + off) * k)
      const buf = new Float32Array(len)
      let idx = 0
      for (let i = 0; i < out.length; i++) {
        const b = buf[idx]
        buf[idx] = out[i] + b * 0.5
        out[i] = b - out[i]
        idx = (idx + 1) % len
      }
    }
    for (let i = 0; i < out.length; i++) out[i] *= 0.12
    return out
  }
  return [chan(0), chan(spread)]
}

/** Ping-pong delay: mono send -> stereo wet (first echo left, then right, ...). */
export function delay(send, time, feedback = 0.35, tone = 3500) {
  const d = secs(time)
  const L = new Float32Array(send.length)
  const R = new Float32Array(send.length)
  const lp = new Biquad("lp", tone)
  for (let i = d; i < send.length; i++) {
    L[i] = lp.run(send[i - d] + R[i - d] * feedback)
    R[i] = L[i - d] * feedback
  }
  return [L, R]
}

// ---- output ------------------------------------------------------------------------------------
/** 16-bit PCM WAV from mono or stereo float buffers. */
export function wav16(chans) {
  const n = chans[0].length
  const nc = chans.length
  const pcm = Buffer.alloc(n * nc * 2)
  for (let i = 0; i < n; i++)
    for (let c = 0; c < nc; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]))
      pcm.writeInt16LE(Math.round(v * 32767), (i * nc + c) * 2)
    }
  const h = Buffer.alloc(44)
  h.write("RIFF", 0)
  h.writeUInt32LE(36 + pcm.length, 4)
  h.write("WAVEfmt ", 8)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(nc, 22)
  h.writeUInt32LE(SR, 24)
  h.writeUInt32LE(SR * nc * 2, 28)
  h.writeUInt16LE(nc * 2, 32)
  h.writeUInt16LE(16, 34)
  h.write("data", 36)
  h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}
