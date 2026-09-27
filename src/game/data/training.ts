// Web-only beginner wave that opens the training sector (not in DOS): map 0 terrain with a
// thinned-out subset of its first third (rows 138..97), shield carriers only and an early,
// weaker boss, so the wave is about 1/3 as long as wave 1.
import { MAPS } from "./ep1"
import type { WaveMap } from "./types"

// CSPRITE records [link, slib, x, y, game, level]; sorted by descending row, level 3 = easy,
// link 0 = spawns together with the next record, 1/-1 ends the group
export const BEGINNER_MAP: WaveMap = {
  flats: MAPS[0]?.flats ?? [],
  spawns: [
    [0, 13, 5, 138, 0, 3],
    [1, 13, 3, 138, 0, 3],
    [0, 15, 2, 136, 0, 3],
    [1, 15, 0, 136, 0, 3],
    [0, 97, 8, 125, 0, 3],
    [1, 98, 0, 125, 0, 3],
    [-1, 74, 0, 121, 0, 3],
    [-1, 102, 4, 120, 0, 3], // shield
    [-1, 74, 2, 119, 0, 3],
    [-1, 74, 4, 117, 0, 3],
    [-1, 73, 3, 115, 0, 3],
    [-1, 75, 1, 113, 0, 3],
    [-1, 75, 2, 111, 0, 3],
    [-1, 102, 6, 110, 0, 3], // shield
    [0, 125, 7, 108, 0, 3],
    [1, 123, 1, 107, 0, 3],
    [-1, 13, 2, 102, 0, 3],
    [-1, 102, 4, 100, 0, 3], // shield
    [-1, 13, 3, 99, 0, 3],
    [-1, 13, 5, 97, 0, 3],
    [-1, 28, 4, 95, 0, 3], // boss SHIP10G1
  ],
  easyBoss: true,
}
