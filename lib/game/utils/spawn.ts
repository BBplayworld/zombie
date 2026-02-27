import type { Vector2, Boundary } from '../config/types'
import type { ZoneMap } from '../systems/ZoneMap'
import type { MonsterDetailConfig } from '../config/types'
import { MOVEMENT } from '../config/constants'
import { getZoneConfig } from '../config/zones'
import { isPositionWalkable } from './movement'

/**
 * 스폰 관련 공통 유틸리티 함수
 * 몬스터 스폰 위치 계산 등
 */

// ============================================================================
// 스폰 위치 계산
// ============================================================================

/**
 * 안전한 스폰 위치 찾기
 * 맵 경계 내에서 이동 가능한 랜덤 위치를 찾음
 * 
 * @param ZoneMap 타일맵 인스턴스
 * @param boundary 맵 경계
 * @param playerPosition 플레이어 위치 (플레이어 근처는 피함)
 * @param zoneId 챕터 ID
 * @returns 스폰 가능한 위치 또는 null
 */
export function findSafeSpawnPosition(
    ZoneMap: ZoneMap,
    boundary: Boundary | undefined,
    playerPosition: Vector2,
    zoneId: number = 1
): Vector2 | null {
    const config = getZoneConfig(zoneId)

    let spawnX = 0
    let spawnY = 0

    if (boundary) {
        // 경계가 있으면 경계 내에서 랜덤 좌표 생성 (마진 적용)
        const safeMinX = boundary.minX + MOVEMENT.SPAWN_MARGIN
        const safeMaxX = boundary.maxX - MOVEMENT.SPAWN_MARGIN
        const safeMinY = boundary.minY + MOVEMENT.SPAWN_MARGIN
        const safeMaxY = boundary.maxY - MOVEMENT.SPAWN_MARGIN

        spawnX = safeMinX + Math.random() * (safeMaxX - safeMinX)
        spawnY = safeMinY + Math.random() * (safeMaxY - safeMinY)
    } else {
        // 경계가 없으면 맵 데이터 그리드 기반
        const mapData = config.mapData
        const gx = Math.floor(Math.random() * mapData.width)
        const gy = Math.floor(Math.random() * mapData.height)
        const wPos = ZoneMap.gridToWorld(gx, gy)
        spawnX = wPos.x
        spawnY = wPos.y
    }

    // 해당 위치가 이동 가능한지 확인
    if (!isPositionWalkable(ZoneMap, spawnX, spawnY, 0, 0)) {
        return null
    }

    // 플레이어와의 거리 확인
    const distToPlayer = Math.sqrt(
        Math.pow(spawnX - playerPosition.x, 2) +
        Math.pow(spawnY - playerPosition.y, 2)
    )

    // 플레이어 바로 옆이면 스킵
    if (distToPlayer < MOVEMENT.PLAYER_SAFE_DISTANCE) {
        return null
    }

    return { x: spawnX, y: spawnY }
}

/**
 * 배회 목표 위치 계산
 * 스폰 위치 주변에서 랜덤한 목표 지점 생성
 * 
 * @param spawnOrigin 스폰 원점
 * @param boundary 맵 경계
 * @param wanderRadius 배회 반경
 * @param wanderMargin 경계 마진
 * @returns 배회 목표 위치
 */
export function calculateWanderTarget(
    spawnOrigin: Vector2,
    boundary: Boundary | undefined,
    wanderRadius: number = 300,
    wanderMargin: number = 150
): Vector2 {
    // 스폰 위치 주변 랜덤 각도와 거리
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * wanderRadius

    let tx = spawnOrigin.x + Math.cos(angle) * dist
    let ty = spawnOrigin.y + Math.sin(angle) * dist

    // 경계를 벗어나면 경계 내로 클램핑
    if (boundary) {
        const safeMinX = boundary.minX + wanderMargin
        const safeMaxX = boundary.maxX - wanderMargin
        const safeMinY = boundary.minY + wanderMargin
        const safeMaxY = boundary.maxY - wanderMargin

        tx = Math.max(safeMinX, Math.min(safeMaxX, tx))
        ty = Math.max(safeMinY, Math.min(safeMaxY, ty))
    }

    return { x: tx, y: ty }
}

/**
 * 유니크 몬스터 ID 생성
 */
export function generateMonsterId(): string {
    return `mon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 랜덤 몬스터 설정 선택
 */
export function selectRandomMonsterConfig(
    monsterConfigs: MonsterDetailConfig[]
): MonsterDetailConfig | null {
    if (!monsterConfigs || monsterConfigs.length === 0) {
        return null
    }
    return monsterConfigs[Math.floor(Math.random() * monsterConfigs.length)]
}
