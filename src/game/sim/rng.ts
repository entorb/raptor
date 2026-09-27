/**
 * Watcom C `rand()` (LCG, 15-bit output) so `random(n) = rand() % n` (GFX/types.h) replays the
 * DOS sequence. Do_Game seeds it with `srand(1024 * wave)`.
 */
export class Rng {
  private seed: number

  constructor(seed = 1) {
    this.seed = seed >>> 0
  }

  srand(seed: number): void {
    this.seed = seed >>> 0
  }

  rand(): number {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0
    return (this.seed >>> 16) & 0x7fff
  }

  /** `random(x)`; guards x <= 0 (a divide error on DOS). */
  random(x: number): number {
    const r = this.rand()
    return x > 0 ? r % x : 0
  }
}
