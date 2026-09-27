// Decoder for Raptor pictures (dosraptor/GFX/GFXAPI.H GFX_PIC, GFXAPI.C GFX_PutSprite).
// Header: { i32 type, i32 opt1, i32 opt2, i32 width, i32 height } = 20 bytes.
// type 1 (GPIC): raw width*height palette indices, 0 = transparent in masked draws.
// type 0 (GSPRITE): runs of { i32 x, i32 y, i32 offset, i32 length } + length pixels,
// terminated by offset == -1.

export const PIC_HEADER = 20

export function picSize(buf) {
  return { type: buf.readInt32LE(0), w: buf.readInt32LE(12), h: buf.readInt32LE(16) }
}

/** Decode to { w, h, px: Uint8Array of palette indices, mask: Uint8Array (1 = opaque) }. */
export function decodePic(buf) {
  const { type, w, h } = picSize(buf)
  const px = new Uint8Array(w * h)
  const mask = new Uint8Array(w * h)
  if (type === 1) {
    for (let i = 0; i < w * h; i++) {
      px[i] = buf[PIC_HEADER + i]
      mask[i] = px[i] ? 1 : 0
    }
    return { w, h, px, mask }
  }
  let p = PIC_HEADER
  while (p + 16 <= buf.length && buf.readInt32LE(p + 8) !== -1) {
    const x = buf.readInt32LE(p)
    const y = buf.readInt32LE(p + 4)
    const len = buf.readInt32LE(p + 12)
    p += 16
    for (let i = 0; i < len; i++) {
      const xx = x + i
      if (xx >= 0 && xx < w && y >= 0 && y < h) {
        px[y * w + xx] = buf[p + i]
        mask[y * w + xx] = 1
      }
    }
    p += len
  }
  return { w, h, px, mask }
}

/** 768-byte 6-bit VGA palette -> [r,g,b] 8-bit triples. */
export function parsePalette(buf) {
  const pal = []
  for (let i = 0; i < 256; i++) {
    const c = (v) => Math.round((buf[i * 3 + v] * 255) / 63)
    pal.push([c(0), c(1), c(2)])
  }
  return pal
}

export function toRgba(pic, pal) {
  const out = Buffer.alloc(pic.w * pic.h * 4)
  for (let i = 0; i < pic.w * pic.h; i++) {
    const [r, g, b] = pal[pic.px[i]] ?? [0, 0, 0]
    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
    out[i * 4 + 3] = pic.mask[i] ? 255 : 0
  }
  return out
}
