// Particle effects for the original ANIMS (explosions, sparks, smoke) in the modern look.
import type { GameObjects, Scene } from "phaser"
import { PLAY, SCALE } from "../data/playfield"
import type { AnimObj } from "../sim/anims"

type Emitter = GameObjects.Particles.ParticleEmitter

export class Effects {
  private readonly scene: Scene
  private readonly fire: Emitter
  private readonly flash: Emitter
  private readonly spark: Emitter
  private readonly smoke: Emitter
  private readonly debris: Emitter
  private readonly energy: Emitter
  private readonly groundFire: Emitter
  /** boom flash / spark tints (training sim: hologram "derez" instead of fire) */
  private readonly boomTint: [number, number]

  constructor(scene: Scene, groundDepth: number, airDepth: number, sim = false) {
    this.scene = scene
    this.boomTint = sim ? [0xb0ffe8, 0x7fffd0] : [0xffe8b0, 0xffd070]
    const add = (tex: string, cfg: Record<string, unknown>, depth: number) =>
      scene.add.particles(0, 0, tex, { emitting: false, ...cfg }).setDepth(depth)
    this.smoke = add(
      "smoke",
      {
        speed: { min: 5, max: 40 },
        lifespan: { min: 600, max: 1200 },
        scale: { start: 0.6, end: 2.2 },
        alpha: { start: 0.35, end: 0 },
        color: sim ? [0x2a8a90, 0x0a2030] : [0x9aa0b0, 0x3a3e48],
        rotate: { min: 0, max: 360 },
      },
      airDepth - 1,
    )
    this.fire = add(
      "dot",
      {
        speed: { min: 30, max: 220 },
        lifespan: { min: 250, max: 700 },
        scale: { start: 1.6, end: 0 },
        alpha: { start: 1, end: 0 },
        color: sim
          ? [0xffffff, 0x9dffe0, 0x2effb4, 0x0a3a40]
          : [0xfff6d0, 0xffc040, 0xff5a20, 0x401010],
        blendMode: "ADD",
      },
      airDepth,
    )
    this.flash = add(
      "dot",
      {
        speed: 0,
        lifespan: 180,
        scale: { start: 4, end: 7 },
        alpha: { start: 0.9, end: 0 },
        blendMode: "ADD",
      },
      airDepth + 1,
    )
    this.spark = add(
      "dot",
      {
        speed: { min: 60, max: 320 },
        lifespan: { min: 120, max: 380 },
        scale: { start: 0.45, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: "ADD",
      },
      airDepth + 1,
    )
    this.debris = add(
      "shard",
      {
        speed: { min: 40, max: 240 },
        lifespan: { min: 500, max: 1100 },
        scale: { start: 1.2, end: 0.2 },
        rotate: { start: 0, end: 720 },
        alpha: { start: 1, end: 0 },
      },
      airDepth,
    )
    this.energy = add(
      "dot",
      {
        speed: { min: 40, max: 260 },
        lifespan: { min: 300, max: 800 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        color: [0xffffff, 0x7fe7ff, 0x2070ff],
        blendMode: "ADD",
      },
      airDepth,
    )
    this.groundFire = add(
      "dot",
      {
        speed: { min: 5, max: 40 },
        angle: { min: 240, max: 300 },
        lifespan: { min: 400, max: 900 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 0.9, end: 0 },
        color: sim ? [0xd0fff0, 0x2effb4, 0x0a4030] : [0xfff0b0, 0xff8a20, 0x802010],
        blendMode: "ADD",
      },
      groundDepth,
    )
  }

  private boom(x: number, y: number, size: number): void {
    const n = Math.round(6 + size * 0.5)
    this.flash.setParticleTint(this.boomTint[0])
    this.flash.explode(1, x, y)
    this.fire.explode(n, x, y)
    this.spark.setParticleTint(this.boomTint[1])
    this.spark.explode(Math.round(n / 2), x, y)
    this.smoke.explode(Math.max(2, Math.round(n / 4)), x, y)
    if (size > 30) this.debris.explode(Math.round(size / 8), x, y)
  }

  /** Start the effect for a newly spawned sim anim (x/y = its DOS center). */
  spawn(a: AnimObj, shake: (n: number) => void): void {
    const lib = a.lib
    const x = (a.dx + lib.xoff) * SCALE
    const y = (a.dy + lib.yoff) * SCALE
    const size = lib.xoff * 2
    switch (lib.kind) {
      case "GEXPLO_BLK":
      case "BOOM_PIC":
      case "LGFLAK_BLK":
      case "AIRBOOM_PIC":
      case "EXPLO2_BLK":
        this.boom(x, y, size)
        if (size >= 40) shake(3)
        return
      case "SMFLAK_BLK":
        this.fire.explode(5, x, y)
        this.spark.setParticleTint(0xffc060)
        this.spark.explode(4, x, y)
        return
      case "NRGBANG_BLK":
        this.flash.setParticleTint(0x7fe7ff)
        this.flash.explode(1, x, y)
        this.energy.explode(24, x, y)
        return
      case "LRBLST_BLK":
        this.flash.setParticleTint(0xff5ad8)
        this.flash.explode(1, x, y)
        return
      case "SSMOKE_BLK":
      case "SSMOKE_DOWN":
      case "SMOKTRAL_BLK":
        this.smoke.explode(1, x, y)
        return
      case "LGHTIN_BLK":
      case "LGHTIN_HIGH":
      case "SPLAT_BLK":
      case "BIGSPLAT_BLK":
        this.energy.explode(6, x, y)
        return
      case "BSPARK_BLK":
        this.spark.setParticleTint(0x7fd8ff)
        this.spark.explode(5, x, y)
        return
      case "OSPARK_BLK":
        this.spark.setParticleTint(0xffb040)
        this.spark.explode(5, x, y)
        return
      case "FLARE_PIC":
      case "SPARKLE_PIC":
        this.groundFire.explode(8, x, y)
        return
      default:
        return // GUNSTR (muzzle) and SHIPGLOW (shield) are drawn by the player view
    }
  }

  /** Nova bomb detonation (DOS: palette flash + shake): screen flash, shockwaves, fireball. */
  nova(x: number, y: number): void {
    const depth = this.flash.depth + 1
    const tween = (obj: GameObjects.Shape, cfg: Record<string, unknown>) =>
      this.scene.tweens.add({ targets: obj, onComplete: () => obj.destroy(), ...cfg })
    const screen = this.scene.add
      .rectangle(0, 0, PLAY.w, PLAY.h, 0xfff4d0, 0.85)
      .setOrigin(0)
      .setDepth(depth)
      .setBlendMode("ADD")
    tween(screen, { alpha: 0, duration: 700, ease: "Quad.easeIn" })
    const core = this.scene.add.circle(x, y, 40, 0xffe890, 1).setDepth(depth).setBlendMode("ADD")
    tween(core, { scale: 5, alpha: 0, duration: 900, ease: "Cubic.easeOut" })
    for (const [i, color] of [0xffffff, 0xffe066, 0xff8a30].entries()) {
      const ring = this.scene.add
        .circle(x, y, 30, color, 0)
        .setStrokeStyle(10 - i * 2, color, 0.9)
        .setDepth(depth)
        .setBlendMode("ADD")
      tween(ring, { scale: 22, alpha: 0, duration: 900, delay: i * 120, ease: "Cubic.easeOut" })
    }
    this.fire.explode(120, x, y)
    this.spark.setParticleTint(0xffe066)
    this.spark.explode(90, x, y)
    this.energy.explode(60, x, y)
    this.flash.setParticleTint(0xffffff)
    this.flash.explode(4, x, y)
    this.smoke.explode(12, x, y)
  }

  /** Extra debris when an enemy dies (bigger ships throw more). */
  wreck(x: number, y: number, w: number, h: number): void {
    const n = Math.min(24, Math.round((w * h) / 120))
    if (n > 0) this.debris.explode(n, x * SCALE, y * SCALE)
    const ring = this.scene.add
      .circle(x * SCALE, y * SCALE, Math.max(w, h) * 0.8, 0xffc070, 0)
      .setStrokeStyle(3, 0xffd090, 0.9)
      .setDepth(this.fire.depth + 1)
      .setBlendMode("ADD")
    this.scene.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 380,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    })
  }
}
