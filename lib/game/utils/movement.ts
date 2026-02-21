import type { Vector2, Boundary } from '../config/types'
import type { TileMap } from '../systems/TileMap'
import { MOVEMENT } from '../config/constants'
import { getChapterConfig } from '../config/chapters'

/**
 * 이동 및 충돌 관련 공통 유틸리티 함수
 * 플레이어와 몬스터가 공통으로 사용
 */

// ============================================================================
// 충돌 검사 함수
// ============================================================================

/**
 * 특정 월드 좌표가 이동 가능한지 확인
 * @param tileMap 타일맵 인스턴스
 * @param worldX 월드 X 좌표
 * @param worldY 월드 Y 좌표
 * @param yOffset Y축 오프셋 (발바닥 위치 보정)
 * @param allowance 허용 범위 (주변 타일 체크)
 * @returns 이동 가능 여부
 */
export function isPositionWalkable(
    tileMap: TileMap | null,
    worldX: number,
    worldY: number,
    yOffset: number = 0,
    allowance: number = 0
): boolean {
    if (!tileMap) return true
    return tileMap.isWalkableAtWorld(worldX, worldY + yOffset, allowance)
}

/**
 * 맵 경계 내에 있는지 확인
 * @param position 확인할 위치
 * @param boundary 맵 경계
 * @param margin 경계로부터의 마진
 * @returns 경계 내에 있으면 true
 */
export function isWithinBoundary(
    position: Vector2,
    boundary: Boundary | undefined,
    margin: number = MOVEMENT.BOUNDARY_MARGIN
): boolean {
    if (!boundary) return true

    return (
        position.x >= boundary.minX + margin &&
        position.x <= boundary.maxX - margin &&
        position.y >= boundary.minY + margin &&
        position.y <= boundary.maxY - margin
    )
}

/**
 * 위치를 맵 경계 내로 제한
 * @param position 제한할 위치 (직접 수정됨)
 * @param boundary 맵 경계
 * @param margin 경계로부터의 마진
 */
export function clampToBoundary(
    position: Vector2,
    boundary: Boundary | undefined,
    margin: number = MOVEMENT.BOUNDARY_MARGIN
): void {
    if (!boundary) return

    if (position.x < boundary.minX + margin) {
        position.x = boundary.minX + margin
    }
    if (position.x > boundary.maxX - margin) {
        position.x = boundary.maxX - margin
    }
    if (position.y < boundary.minY + margin) {
        position.y = boundary.minY + margin
    }
    if (position.y > boundary.maxY - margin) {
        position.y = boundary.maxY - margin
    }
}

// ============================================================================
// 이동 처리 함수
// ============================================================================

/**
 * 엔티티 이동 처리 (충돌 검사 포함)
 * X축과 Y축을 분리하여 처리하여 벽에 걸렸을 때 미끄러지는 효과 구현
 * 
 * @param position 현재 위치 (직접 수정됨)
 * @param velocity 이동 속도 (충돌 시 0으로 설정됨)
 * @param deltaTime 델타 타임
 * @param tileMap 타일맵 인스턴스
 * @param chapterId 챕터 ID
 * @returns 이동 성공 여부
 */
export function processEntityMovement(
    position: Vector2,
    velocity: Vector2,
    deltaTime: number,
    tileMap: TileMap | null,
    chapterId: number = 1
): boolean {
    if (!tileMap) {
        // 타일맵이 없으면 자유 이동
        const timeScale = deltaTime * 60
        position.x += velocity.x * timeScale
        position.y += velocity.y * timeScale
        return true
    }

    const config = getChapterConfig(chapterId)
    const offset = config.gameplayConfig.collisionYOffset
    const allowance = 0
    const timeScale = deltaTime * 60

    const moveX = velocity.x * timeScale
    const moveY = velocity.y * timeScale

    let moved = false

    // X축 이동 시도
    const nextX = position.x + moveX
    if (isPositionWalkable(tileMap, nextX, position.y, offset, allowance)) {
        position.x = nextX
        moved = true
    } else {
        velocity.x = 0
    }

    // Y축 이동 시도
    const nextY = position.y + moveY
    if (isPositionWalkable(tileMap, position.x, nextY, offset, allowance)) {
        position.y = nextY
        moved = true
    } else {
        velocity.y = 0
    }

    // 맵 경계 강제 적용
    const boundary = config.openWorldMapConfig?.walkableArea ?? config.openWorldMapConfig?.mapBoundary
    if (boundary) {
        clampToBoundary(position, boundary)

        // 경계에 막혔으면 속도 0
        if (position.x === boundary.minX + MOVEMENT.BOUNDARY_MARGIN ||
            position.x === boundary.maxX - MOVEMENT.BOUNDARY_MARGIN) {
            velocity.x = 0
        }
        if (position.y === boundary.minY + MOVEMENT.BOUNDARY_MARGIN ||
            position.y === boundary.maxY - MOVEMENT.BOUNDARY_MARGIN) {
            velocity.y = 0
        }
    }

    return moved
}

// ============================================================================
// 방향 계산 함수
// ============================================================================

/**
 * 이동 벡터로부터 4방향 결정
 * @param vx X 방향 속도
 * @param vy Y 방향 속도
 * @returns 방향 문자열
 */
export function getDirectionFromVelocity(
    vx: number,
    vy: number
): 'idle' | 'up' | 'down' | 'left' | 'right' {
    if (vx === 0 && vy === 0) return 'idle'

    if (Math.abs(vx) > Math.abs(vy)) {
        return vx > 0 ? 'right' : 'left'
    } else {
        return vy > 0 ? 'down' : 'up'
    }
}

/**
 * 두 점 사이의 거리 계산
 */
export function getDistance(p1: Vector2, p2: Vector2): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 두 점 사이의 방향 벡터 계산 (정규화됨)
 */
export function getDirectionVector(from: Vector2, to: Vector2): Vector2 {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist === 0) return { x: 0, y: 0 }

    return {
        x: dx / dist,
        y: dy / dist
    }
}

/**
 * 벡터 정규화
 */
export function normalizeVector(v: Vector2): Vector2 {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y)
    if (mag === 0) return { x: 0, y: 0 }
    return { x: v.x / mag, y: v.y / mag }
}
