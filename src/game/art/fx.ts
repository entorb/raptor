// Procedural effect textures: shots, particles, pickups, map structures.
import { PIC_SIZES } from "../data/ep1"
import { Obj } from "../sim/consts"
import { type Ctx, canopy, glow, metal, polyPath, roundRect, seeded } from "./draw"

/**
 * Visible pixels [x, y, w, h] of the original shot pictures inside their PIC_SIZES box (DOS px,
 * frame 0). The pictures are mostly padding: the Twin Blaster shot is a 2x2 dot in an 8x8 box.
 */
const SHOT_BOX: Record<string, [number, number, number, number]> = {
  NMSHOT_BLK: [3, 3, 2, 2],
  PLASMA_BLK: [2, 0, 3, 8],
  MICROM_BLK: [2, 0, 3, 7],
  MISDUM_BLK: [2, 1, 4, 11],
  MISRAT_BLK: [2, 0, 4, 13],
  MISGRD_BLK: [1, 0, 6, 11],
  BLDGBOMB_PIC: [2, 0, 4, 8],
  POWDIS_BLK: [2, 3, 13, 11],
  MEGABM_BLK: [1, 0, 6, 8],
  SHOKWV_BLK: [0, 0, 16, 14],
  FRNTLAS_BLK: [2, 0, 4, 3],
  DETHRY_BLK: [0, 0, 8, 3],
  ESHOT_BLK: [1, 1, 6, 6],
  EMISLE_BLK: [2, 3, 4, 13],
  MINE_BLK: [1, 1, 7, 7],
  ELASER_BLK: [2, 0, 4, 8],
  EPLASMA_PIC: [2, 0, 4, 8],
  COCONUT_PIC: [2, 1, 5, 5],
}

/**
 * Shot texture of width tw (3x DOS size): the art is drawn into the original's visible box
 * (SHOT_BOX) so sizes match DOS; the rest stays free for the glow.
 */
export function drawShot(ctx: Ctx, key: string, tw: number): void {
  const [bx, by, bw, bh] = SHOT_BOX[key] ?? [0, 0, ...(PIC_SIZES[key] ?? [8, 8])]
  const k = tw / (PIC_SIZES[key]?.[0] ?? 8)
  ctx.save()
  ctx.translate(bx * k, by * k)
  drawShotArt(ctx, key, bw * k, bh * k)
  ctx.restore()
}

function drawShotArt(ctx: Ctx, key: string, w: number, h: number): void {
  const cx = w / 2
  const cy = h / 2
  const bolt = (color: string, core: string) => {
    ctx.save()
    ctx.globalCompositeOperation = "lighter"
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, "rgba(0,0,0,0)")
    g.addColorStop(0.3, color)
    g.addColorStop(0.5, core)
    g.addColorStop(0.7, color)
    g.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = g
    roundRect(ctx, cx - w * 0.22, 0, w * 0.44, h, w * 0.22)
    ctx.fill()
    ctx.restore()
    glow(ctx, cx, cy, Math.min(w, h) * 0.5, color, core)
  }
  const missile = (body: string, flame: string, down = false) => {
    ctx.save()
    if (down) {
      ctx.translate(0, h)
      ctx.scale(1, -1)
    }
    glow(ctx, cx, h * 0.92, w * 0.5, flame)
    polyPath(ctx, [
      [cx, 0],
      [cx + w * 0.22, h * 0.2],
      [cx + w * 0.22, h * 0.8],
      [cx + w * 0.4, h * 0.95],
      [cx - w * 0.4, h * 0.95],
      [cx - w * 0.22, h * 0.8],
      [cx - w * 0.22, h * 0.2],
    ])
    metal(ctx, cx - w * 0.4, cx + w * 0.4, "#2a2e36", body, "#ffffff", ["rgba(255,255,255,0.3)", 1])
    ctx.restore()
  }
  switch (key) {
    case "NMSHOT_BLK":
      // 2x2 DOS dot: bright core with a small halo
      glow(ctx, cx, cy, w * 0.9, "#39d0ff", "#ffffff")
      return
    case "PLASMA_BLK":
      // teardrop: bright head, fading tail
      bolt("#6dff6d", "#f0fff0")
      glow(ctx, cx, h * 0.25, w * 0.6, "#6dff6d", "#ffffff")
      return
    case "MICROM_BLK":
    case "MISRAT_BLK":
      missile("#9fb7d6", "#ffb347")
      return
    case "MISDUM_BLK":
      missile("#d6c49f", "#ff7a2e")
      return
    case "MISGRD_BLK":
      missile("#9fd6a5", "#ff7a2e")
      return
    case "BLDGBOMB_PIC":
      ctx.beginPath()
      ctx.ellipse(cx, cy, w * 0.5, h * 0.48, 0, 0, Math.PI * 2)
      metal(ctx, 0, w, "#222", "#666", "#ddd")
      glow(ctx, cx, cy, w * 0.3, "#ff3d4a")
      return
    case "POWDIS_BLK":
      ctx.strokeStyle = "#8ffcff"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(cx, cy, w * 0.42, h * 0.3, 0, 0, Math.PI * 2)
      ctx.stroke()
      glow(ctx, cx, cy, w * 0.35, "#39d0ff")
      return
    case "MEGABM_BLK": {
      // nova warhead flying up: exhaust, tail fins, dark casing, glowing energy core + ring
      glow(ctx, cx, h * 0.98, w * 0.45, "#ff9a2e")
      polyPath(ctx, [
        [cx - w * 0.2, h * 0.62],
        [0, h * 0.95],
        [cx - w * 0.2, h * 0.86],
      ])
      metal(ctx, 0, cx, "#2a2410", "#7a6a3a", "#c9b27a", ["rgba(255,224,102,0.6)", 1])
      polyPath(ctx, [
        [cx + w * 0.2, h * 0.62],
        [w, h * 0.95],
        [cx + w * 0.2, h * 0.86],
      ])
      metal(ctx, cx, w, "#2a2410", "#7a6a3a", "#c9b27a", ["rgba(255,224,102,0.6)", 1])
      polyPath(ctx, [
        [cx, 0],
        [cx + w * 0.3, h * 0.2],
        [cx + w * 0.3, h * 0.84],
        [cx - w * 0.3, h * 0.84],
        [cx - w * 0.3, h * 0.2],
      ])
      metal(ctx, cx - w * 0.3, cx + w * 0.3, "#1c1a22", "#55505e", "#b8b0c4", [
        "rgba(255,255,255,0.35)",
        1,
      ])
      ctx.fillStyle = "#ffe066"
      ctx.fillRect(cx - w * 0.3, h * 0.3, w * 0.6, h * 0.05)
      ctx.fillRect(cx - w * 0.3, h * 0.66, w * 0.6, h * 0.05)
      ctx.beginPath()
      ctx.ellipse(cx, h * 0.5, w * 0.2, h * 0.11, 0, 0, Math.PI * 2)
      ctx.fillStyle = "#fff6c0"
      ctx.fill()
      glow(ctx, cx, h * 0.5, w * 0.75, "#ffc930", "#ffffff")
      return
    }
    case "SHOKWV_BLK":
      ctx.save()
      ctx.globalCompositeOperation = "lighter"
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(160,120,255,${0.9 - i * 0.25})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx, h * (0.9 + i * 0.12), w * (0.45 - i * 0.05), Math.PI * 1.15, Math.PI * 1.85)
        ctx.stroke()
      }
      ctx.restore()
      return
    case "FRNTLAS_BLK":
      bolt("#ff3dd2", "#ffffff")
      return
    case "DETHRY_BLK":
      bolt("#ffe03d", "#ffffff")
      return
    // enemy projectiles
    case "ESHOT_BLK":
      glow(ctx, cx, cy, Math.min(w, h) * 0.5, "#ff3d4a", "#fff0e0")
      return
    case "EMISLE_BLK":
      missile("#c8a0a0", "#ff5a2e", true)
      return
    case "MINE_BLK":
      ctx.beginPath()
      ctx.arc(cx, cy, w * 0.36, 0, Math.PI * 2)
      metal(ctx, 0, w, "#201010", "#703030", "#ff9090")
      for (let a = 0; a < 8; a++) {
        const x = cx + Math.cos((a * Math.PI) / 4) * w * 0.42
        const y = cy + Math.sin((a * Math.PI) / 4) * h * 0.42
        glow(ctx, x, y, w * 0.08, "#ff3d4a")
      }
      return
    case "ELASER_BLK":
      bolt("#ff2e2e", "#ffe0e0")
      return
    case "EPLASMA_PIC":
      bolt("#ff8a2e", "#ffffff")
      glow(ctx, cx, h * 0.7, w * 0.6, "#ff8a2e", "#ffffff")
      return
    case "COCONUT_PIC":
      ctx.beginPath()
      ctx.arc(cx, cy, w * 0.5, 0, Math.PI * 2)
      metal(ctx, 0, w, "#1a1030", "#7a4bd8", "#e6d7ff")
      return
    default:
      glow(ctx, cx, cy, Math.min(w, h) * 0.5, "#ffffff")
      return
  }
}

export function drawDot(ctx: Ctx, s: number): void {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, "rgba(255,255,255,1)")
  g.addColorStop(0.3, "rgba(255,255,255,0.6)")
  g.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
}

export function drawSmoke(ctx: Ctx, s: number): void {
  const r = seeded(7)
  for (let i = 0; i < 6; i++) {
    const x = s * (0.3 + r() * 0.4)
    const y = s * (0.3 + r() * 0.4)
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 0.3)
    g.addColorStop(0, "rgba(255,255,255,0.35)")
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  }
}

export function drawShard(ctx: Ctx, s: number): void {
  polyPath(ctx, [
    [s * 0.5, 0],
    [s, s * 0.4],
    [s * 0.6, s],
    [0, s * 0.6],
  ])
  metal(ctx, 0, s, "#1b1f28", "#56627a", "#c8d2e6", ["rgba(255,255,255,0.4)", 1])
}

/** Pickup color + glyph per object type. */
const PICKUP: Partial<Record<number, [string, string]>> = {
  [Obj.FORWARD_GUNS]: ["#39d0ff", "B"],
  [Obj.PLASMA_GUNS]: ["#6dff6d", "P"],
  [Obj.MICRO_MISSLE]: ["#ffb347", "M"],
  [Obj.DUMB_MISSLE]: ["#ff7a2e", "D"],
  [Obj.MINI_GUN]: ["#ffe03d", "G"],
  [Obj.TURRET]: ["#ff3dd2", "T"],
  [Obj.MISSLE_PODS]: ["#ff9a2e", "R"],
  [Obj.AIR_MISSLE]: ["#9fb7ff", "A"],
  [Obj.GRD_MISSLE]: ["#9fd6a5", "S"],
  [Obj.BOMB]: ["#ff5050", "H"],
  [Obj.ENERGY_GRAB]: ["#8ffcff", "E"],
  [Obj.MEGA_BOMB]: ["#ffe066", "N"],
  [Obj.PULSE_CANNON]: ["#a078ff", "W"],
  [Obj.FORWARD_LASER]: ["#ff3dd2", "L"],
  [Obj.DEATH_RAY]: ["#ffe03d", "X"],
  [Obj.SUPER_SHIELD]: ["#46e0ff", "Φ"],
  [Obj.ENERGY]: ["#2effb4", "+"],
  [Obj.DETECT]: ["#ffffff", "?"],
}

/** Hex badge pickup / HUD icon (money types become a golden crystal). */
export function drawPickup(ctx: Ctx, type: number, s: number): void {
  const cx = s / 2
  const cy = s / 2
  const def = PICKUP[type]
  if (!def) {
    // credits / energy crystal
    polyPath(ctx, [
      [cx, s * 0.08],
      [s * 0.8, cy],
      [cx, s * 0.92],
      [s * 0.2, cy],
    ])
    metal(ctx, s * 0.2, s * 0.8, "#6b4a00", "#ffc83d", "#fff6c8", ["rgba(255,255,255,0.6)", 1.5])
    glow(ctx, cx, cy, s * 0.3, "#ffd23d")
    return
  }
  const [color, glyph] = def
  glow(ctx, cx, cy, s * 0.5, color, color)
  const pts: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3
    pts.push([cx + Math.cos(a) * s * 0.4, cy + Math.sin(a) * s * 0.4])
  }
  polyPath(ctx, pts)
  ctx.fillStyle = "rgba(10,14,24,0.85)"
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.fillStyle = "#ffffff"
  ctx.font = `bold ${Math.round(s * 0.42)}px system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(glyph, cx, cy + 1)
}

/** Solar cell grid (the two top middle cells are left out for the hub). */
function solarCells(ctx: Ctx, s: number): void {
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 4; col++) {
      if (row === 0 && (col === 1 || col === 2)) continue
      roundRect(ctx, s * (0.15 + col * 0.18), s * (0.23 + row * 0.28), s * 0.15, s * 0.25, 2)
      ctx.fillStyle = "#0e2a48"
      ctx.fill()
      ctx.strokeStyle = "rgba(70,224,255,0.35)"
      ctx.lineWidth = 1
      ctx.stroke()
    }
}

/** Destructible map structure (station module) on a 96x96 cell; `kind` picks the design. */
export function drawStructure(ctx: Ctx, kind: number, s: number): void {
  const cx = s / 2
  const cy = s / 2
  const pal = ["#2effb4", "#ffae2e", "#46e0ff", "#ff5a7a"][kind % 4] as string
  switch (kind % 4) {
    case 0: {
      // reactor dome
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2)
      metal(ctx, 0, s, "#1c1e24", "#5a6070", "#d0d6e4")
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4
        glow(ctx, cx + Math.cos(a) * s * 0.3, cy + Math.sin(a) * s * 0.3, s * 0.05, pal)
      }
      canopy(ctx, cx, cy, s * 0.16, s * 0.16, pal)
      break
    }
    case 1: {
      // fuel tanks
      for (const [x, y] of [
        [0.3, 0.3],
        [0.7, 0.3],
        [0.3, 0.7],
        [0.7, 0.7],
      ]) {
        ctx.beginPath()
        ctx.arc(s * (x as number), s * (y as number), s * 0.17, 0, Math.PI * 2)
        metal(
          ctx,
          s * ((x as number) - 0.17),
          s * ((x as number) + 0.17),
          "#2a2218",
          "#8a7650",
          "#f0e0b0",
        )
      }
      glow(ctx, cx, cy, s * 0.1, pal)
      break
    }
    case 2: {
      // solar panel module (same footprint as the cargo block)
      roundRect(ctx, s * 0.1, s * 0.18, s * 0.8, s * 0.64, 6)
      metal(ctx, 0, s, "#161a22", "#465062", "#b9c3d6")
      solarCells(ctx, s)
      roundRect(ctx, s * 0.33, s * 0.23, s * 0.33, s * 0.25, 3)
      ctx.fillStyle = "rgba(0,0,0,0.35)"
      ctx.fill()
      glow(ctx, cx, s * 0.355, s * 0.07, pal)
      break
    }
    default: {
      // cargo block
      roundRect(ctx, s * 0.1, s * 0.18, s * 0.8, s * 0.64, 6)
      metal(ctx, 0, s, "#1c1618", "#6a4a54", "#e8c8d0")
      for (let i = 0; i < 3; i++) {
        roundRect(ctx, s * (0.16 + i * 0.24), s * 0.26, s * 0.2, s * 0.48, 3)
        ctx.fillStyle = "rgba(0,0,0,0.35)"
        ctx.fill()
      }
      glow(ctx, s * 0.84, s * 0.24, s * 0.05, pal)
      break
    }
  }
}

/** Scorched wreck left by a destroyed structure. */
export function drawWreck(ctx: Ctx, s: number, seed: number): void {
  const r = seeded(seed)
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.48)
  g.addColorStop(0, "rgba(0,0,0,0.9)")
  g.addColorStop(0.7, "rgba(20,10,5,0.6)")
  g.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  for (let i = 0; i < 7; i++) {
    const x = s * (0.2 + r() * 0.6)
    const y = s * (0.2 + r() * 0.6)
    polyPath(ctx, [
      [x, y],
      [x + s * 0.1 * r(), y + s * 0.05],
      [x + s * 0.03, y + s * 0.1 * r()],
    ])
    ctx.fillStyle = "#3a3f4a"
    ctx.fill()
  }
  for (let i = 0; i < 4; i++)
    glow(ctx, s * (0.25 + r() * 0.5), s * (0.25 + r() * 0.5), s * 0.06, "#ff7a2e")
}
