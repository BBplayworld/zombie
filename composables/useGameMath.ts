/**
 * 2D 벡터 유틸리티
 */
export interface Vector2D {
  x: number
  y: number
}

export class Vector2 {
  constructor(public x: number = 0, public y: number = 0) {}

  add(v: Vector2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y)
  }

  subtract(v: Vector2): Vector2 {
    return new Vector2(this.x - v.x, this.y - v.y)
  }

  multiply(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar)
  }

  divide(scalar: number): Vector2 {
    return new Vector2(this.x / scalar, this.y / scalar)
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }

  normalize(): Vector2 {
    const mag = this.magnitude()
    return mag > 0 ? this.divide(mag) : new Vector2(0, 0)
  }

  distance(v: Vector2): number {
    return Math.sqrt(Math.pow(this.x - v.x, 2) + Math.pow(this.y - v.y, 2))
  }

  angle(): number {
    return Math.atan2(this.y, this.x)
  }

  static fromAngle(angle: number, length: number = 1): Vector2 {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length)
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y)
  }
}

/**
 * 보간 유틸리티
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * 좌표 변환 유틸리티
 */
export function worldToScreen(worldPos: Vector2, camera: { x: number, y: number }): Vector2 {
  return new Vector2(worldPos.x - camera.x, worldPos.y - camera.y)
}

export function screenToWorld(screenPos: Vector2, camera: { x: number, y: number }): Vector2 {
  return new Vector2(screenPos.x + camera.x, screenPos.y + camera.y)
}
