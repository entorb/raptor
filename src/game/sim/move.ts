/** MOVEOBJ Bresenham stepping (dosraptor/SOURCE/RAP.C InitMobj/MoveMobj/MoveSobj, ENEMY.C MoveEobj). */
export interface MoveObj {
  x: number
  y: number
  x2: number
  y2: number
  delx: number
  dely: number
  addx: number
  addy: number
  maxloop: number
  err: number
  done: boolean
}

export function newMove(x = 0, y = 0, x2 = 0, y2 = 0): MoveObj {
  return { x, y, x2, y2, delx: 0, dely: 0, addx: 0, addy: 0, maxloop: 0, err: 0, done: false }
}

export function initMobj(m: MoveObj): void {
  m.done = false
  m.addx = 1
  m.addy = 1
  m.delx = m.x2 - m.x
  m.dely = m.y2 - m.y
  if (m.delx < 0) {
    m.delx = -m.delx
    m.addx = -m.addx
  }
  if (m.dely < 0) {
    m.dely = -m.dely
    m.addy = -m.addy
  }
  if (m.delx >= m.dely) {
    m.err = -(m.dely >> 1)
    m.maxloop = m.delx + 1
  } else {
    m.err = m.delx >> 1
    m.maxloop = m.dely + 1
  }
}

function step(m: MoveObj): void {
  if (m.delx >= m.dely) {
    m.x += m.addx
    m.err += m.dely
    if (m.err > 0) {
      m.y += m.addy
      m.err -= m.delx
    }
  } else {
    m.y += m.addy
    m.err += m.delx
    if (m.err > 0) {
      m.x += m.addx
      m.err -= m.dely
    }
  }
}

export function moveMobj(m: MoveObj): void {
  if (m.maxloop === 0) {
    m.done = true
    return
  }
  step(m)
  m.maxloop--
}

/** MoveSobj: `speed` steps, keeps going past the target; done once maxloop < 1. */
export function moveSobj(m: MoveObj, speed: number): number {
  if (speed === 0) return 0
  while (speed) {
    speed--
    m.maxloop--
    step(m)
  }
  if (m.maxloop < 1) m.done = true
  return speed
}

/** MoveEobj: like MoveSobj but stops on the target and returns the unused speed. */
export function moveEobj(m: MoveObj, speed: number): number {
  if (speed === 0) return 0
  while (speed) {
    speed--
    m.maxloop--
    if (m.maxloop === 0) {
      m.done = true
      return speed
    }
    step(m)
  }
  if (m.maxloop < 1) m.done = true
  return speed
}
