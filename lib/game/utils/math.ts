/**
 * 수학 유틸리티
 * 벡터 연산, 보간, 좌표 변환 등
 */

import type { Vector2 as Vector2Interface } from '../config/types'

// ============================================================================
// Vector2 클래스
// ============================================================================

/**
 * 2D 벡터 클래스
 * 위치, 속도, 방향 등을 표현하는 데 사용
 */
export class Vector2 implements Vector2Interface {
    constructor(public x: number = 0, public y: number = 0) { }

    /**
     * 벡터 덧셈
     */
    add(v: Vector2): Vector2 {
        return new Vector2(this.x + v.x, this.y + v.y)
    }

    /**
     * 벡터 뺄셈
     */
    subtract(v: Vector2): Vector2 {
        return new Vector2(this.x - v.x, this.y - v.y)
    }

    /**
     * 스칼라 곱셈
     */
    multiply(scalar: number): Vector2 {
        return new Vector2(this.x * scalar, this.y * scalar)
    }

    /**
     * 스칼라 나눗셈
     */
    divide(scalar: number): Vector2 {
        if (scalar === 0) return new Vector2(0, 0)
        return new Vector2(this.x / scalar, this.y / scalar)
    }

    /**
     * 벡터 크기 (길이)
     */
    magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    /**
     * 벡터 정규화 (단위 벡터로 변환)
     */
    normalize(): Vector2 {
        const mag = this.magnitude()
        return mag > 0 ? this.divide(mag) : new Vector2(0, 0)
    }

    /**
     * 다른 벡터와의 거리
     */
    distance(v: Vector2): number {
        return Math.sqrt(Math.pow(this.x - v.x, 2) + Math.pow(this.y - v.y, 2))
    }

    /**
     * 벡터의 각도 (라디안)
     */
    angle(): number {
        return Math.atan2(this.y, this.x)
    }

    /**
     * 각도로부터 벡터 생성
     */
    static fromAngle(angle: number, length: number = 1): Vector2 {
        return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length)
    }

    /**
     * 벡터 복사
     */
    clone(): Vector2 {
        return new Vector2(this.x, this.y)
    }

    /**
     * 두 벡터의 내적 (dot product)
     */
    dot(v: Vector2): number {
        return this.x * v.x + this.y * v.y
    }

    /**
     * 벡터를 특정 길이로 제한
     */
    limit(max: number): Vector2 {
        const mag = this.magnitude()
        if (mag > max) {
            return this.normalize().multiply(max)
        }
        return this.clone()
    }
}

// ============================================================================
// 보간 함수
// ============================================================================

/**
 * 선형 보간 (Linear Interpolation)
 * @param start 시작 값
 * @param end 끝 값
 * @param t 보간 비율 (0~1)
 */
export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t
}

/**
 * 값을 특정 범위로 제한
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

/**
 * 부드러운 보간 (Smooth Step)
 */
export function smoothStep(start: number, end: number, t: number): number {
    t = clamp((t - start) / (end - start), 0, 1)
    return t * t * (3 - 2 * t)
}

// ============================================================================
// 좌표 변환 함수
// ============================================================================

/**
 * 월드 좌표를 스크린 좌표로 변환
 */
export function worldToScreen(
    worldPos: Vector2Interface,
    camera: { x: number; y: number }
): Vector2 {
    return new Vector2(worldPos.x - camera.x, worldPos.y - camera.y)
}

/**
 * 스크린 좌표를 월드 좌표로 변환
 */
export function screenToWorld(
    screenPos: Vector2Interface,
    camera: { x: number; y: number }
): Vector2 {
    return new Vector2(screenPos.x + camera.x, screenPos.y + camera.y)
}

// ============================================================================
// 각도 및 회전 함수
// ============================================================================

/**
 * 도(degree)를 라디안(radian)으로 변환
 */
export function degToRad(degrees: number): number {
    return degrees * (Math.PI / 180)
}

/**
 * 라디안(radian)을 도(degree)로 변환
 */
export function radToDeg(radians: number): number {
    return radians * (180 / Math.PI)
}

/**
 * 두 점 사이의 각도 계산 (라디안)
 */
export function angleBetween(from: Vector2Interface, to: Vector2Interface): number {
    return Math.atan2(to.y - from.y, to.x - from.x)
}

// ============================================================================
// 랜덤 함수
// ============================================================================

/**
 * 범위 내 랜덤 정수
 */
export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 범위 내 랜덤 실수
 */
export function randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min
}

/**
 * 랜덤 방향 벡터 (정규화됨)
 */
export function randomDirection(): Vector2 {
    const angle = Math.random() * Math.PI * 2
    return Vector2.fromAngle(angle)
}
