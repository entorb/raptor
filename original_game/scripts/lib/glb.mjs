// Reader for Raptor GLB archives (dosraptor/GFX/GLBAPI.C).
// Layout: KEYFILE[0] = header (offset = item count), KEYFILE[1..n] = directory,
// each 28 bytes { u32 opt, u32 offset, u32 filesize, char name[16] }, every entry
// encrypted on its own. Item data is encrypted only when opt == 1 (GLB_ENCODED).

const KEY = "32768GLB"
const SEED = 25
const ENTRY = 28

/** GLB_DeCrypt: out = in - key[k] - prev, prev = previous cipher byte. */
export function decrypt(buf, key = KEY) {
  const out = Buffer.alloc(buf.length)
  let kidx = SEED % key.length
  let prev = key.codePointAt(kidx)
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i]
    out[i] = (c - key.codePointAt(kidx) - prev) & 0xff
    prev = c
    if (++kidx >= key.length) kidx = 0
  }
  return out
}

/** GLB_EnCrypt (inverse of decrypt), only used by the self-check. */
export function encrypt(buf, key = KEY) {
  const out = Buffer.alloc(buf.length)
  let kidx = SEED % key.length
  let prev = key.codePointAt(kidx)
  for (let i = 0; i < buf.length; i++) {
    prev = (buf[i] + key.codePointAt(kidx) + prev) & 0xff
    out[i] = prev
    if (++kidx >= key.length) kidx = 0
  }
  return out
}

/** Parse a whole GLB file buffer into [{ name, size, offset, encoded, data() }]. */
export function parseGlb(file) {
  const head = decrypt(file.subarray(0, ENTRY))
  const count = head.readUInt32LE(4)
  const items = []
  for (let i = 0; i < count; i++) {
    const e = decrypt(file.subarray(ENTRY * (i + 1), ENTRY * (i + 2)))
    const opt = e.readUInt32LE(0)
    const offset = e.readUInt32LE(4)
    const size = e.readUInt32LE(8)
    const raw = e.subarray(12, 28)
    const end = raw.indexOf(0)
    const name = raw.subarray(0, end < 0 ? 16 : end).toString("latin1")
    items.push({
      name,
      size,
      offset,
      encoded: opt === 1,
      data() {
        const d = file.subarray(offset, offset + size)
        return opt === 1 ? decrypt(d) : Buffer.from(d)
      },
    })
  }
  return items
}

export function runGlbSelfCheck() {
  const plain = Buffer.from("RAPTOR call of the shadows 0123456789")
  const round = decrypt(encrypt(plain))
  if (!round.equals(plain)) throw new Error("GLB encrypt/decrypt round-trip failed")
}
