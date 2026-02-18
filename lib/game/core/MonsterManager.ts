import { Monster } from '../entities/Monster'
import { TileMap } from '../systems/TileMap'
import { ResourceLoader } from '../systems/ResourceLoader'
import { Vector2 } from '../utils/math'

/**
 * 몬스터 스폰 및 관리 클래스
 * 몬스터 생성, 스폰, 리젠 로직을 담당
 */
export class MonsterManager {
    public monsters: Monster[] = []
    private tileMap: TileMap
    private resourceLoader: ResourceLoader
    private initialSpawnComplete: boolean = false
    private lastRegenCheckTime: number = 0

    constructor(tileMap: TileMap, resourceLoader: ResourceLoader) {
        this.tileMap = tileMap
        this.resourceLoader = resourceLoader
    }

    /**
     * 몬스터 초기 스폰
     */
    spawnInitialMonsters(config: any, playerPosition: Vector2): void {
        if (this.initialSpawnComplete) return

        const targetCount = config.gameplayConfig.monsterConfig?.spawnCount || 0
        const spawnedCount = this.executeMonsterSpawn(targetCount, config, playerPosition)

        this.initialSpawnComplete = true
        if (spawnedCount > 0) {
            console.log(`Initial spawn: ${spawnedCount} monsters.`)
        }
    }

    /**
     * 몬스터 리젠 처리
     */
    handleRespawn(config: any, playerPosition: Vector2, currentTime: number): void {
        const targetCount = config.gameplayConfig.monsterConfig?.spawnCount || 0
        const needed = targetCount - this.monsters.length

        if (needed <= 0) return

        // 리젠 타이머 초기화
        if (!this.lastRegenCheckTime) {
            this.lastRegenCheckTime = currentTime
        }

        // 리젠 간격 체크
        const regenInterval = (config.gameplayConfig.monsterConfig?.regenTime || 1) * 1000
        if (currentTime - this.lastRegenCheckTime < regenInterval) return

        this.lastRegenCheckTime = currentTime
        const spawnedCount = this.executeMonsterSpawn(needed, config, playerPosition)

        if (spawnedCount > 0) {
            console.log(`Respawned ${spawnedCount} monsters.`)
        }
    }

    /**
     * 죽은 몬스터 제거 및 반환
     */
    removeDeadMonsters(): Monster[] {
        const dead = this.monsters.filter(m => m.isDead)
        this.monsters = this.monsters.filter(m => !m.isDead)
        return dead
    }

    /**
     * 모든 몬스터 업데이트
     */
    updateAll(deltaTime: number): void {
        this.monsters.forEach(monster => monster.update(deltaTime))
    }

    /**
     * 몬스터 스폰 실행
     */
    private executeMonsterSpawn(targetCount: number, config: any, playerPosition: Vector2): number {
        const SPAWN_MARGIN = 100
        const MAX_ATTEMPTS = targetCount * 50
        let spawnedCount = 0

        for (let attempts = 0; attempts < MAX_ATTEMPTS && spawnedCount < targetCount; attempts++) {
            const spawnPos = this.generateSpawnPosition(config, SPAWN_MARGIN)
            if (!spawnPos) continue

            const isValidSpawn = this.validateSpawnPosition(spawnPos.x, spawnPos.y, playerPosition, config)
            if (!isValidSpawn) continue

            const monster = this.createMonster(spawnPos.x, spawnPos.y, config)
            if (!monster) continue

            this.monsters.push(monster)
            spawnedCount++
        }

        return spawnedCount
    }

    /**
     * 스폰 위치 생성 (walkableArea 우선 사용)
     */
    private generateSpawnPosition(config: any, margin: number): { x: number; y: number } | null {
        // walkableArea 우선, 없으면 mapBoundary 사용 (하위 호환)
        const mapConfig = config.openWorldMapConfig || config.tileMapConfig
        if (!mapConfig) return this.generateGridSpawnPosition(config.mapData)

        const area = mapConfig.walkableArea || mapConfig.mapBoundary

        if (area) {
            return this.generateBoundarySpawnPosition(area, margin)
        }

        return this.generateGridSpawnPosition(config.mapData)
    }

    /**
     * 경계 기반 스폰 위치 생성
     */
    private generateBoundarySpawnPosition(boundary: any, margin: number): { x: number; y: number } {
        const safeMinX = boundary.minX + margin
        const safeMaxX = boundary.maxX - margin
        const safeMinY = boundary.minY + margin
        const safeMaxY = boundary.maxY - margin

        return {
            x: safeMinX + Math.random() * (safeMaxX - safeMinX),
            y: safeMinY + Math.random() * (safeMaxY - safeMinY)
        }
    }

    /**
     * 그리드 기반 스폰 위치 생성
     */
    private generateGridSpawnPosition(mapData: any): { x: number; y: number } {
        const gx = Math.floor(Math.random() * mapData.width)
        const gy = Math.floor(Math.random() * mapData.height)
        return this.tileMap.gridToWorld(gx, gy)
    }

    /**
     * 스폰 위치 유효성 검사
     */
    private validateSpawnPosition(x: number, y: number, playerPosition: Vector2, config: any): boolean {
        const SAFE_DISTANCE_FROM_PLAYER = 500
        const offset = config.gameplayConfig?.collisionYOffset || 80 // Default to 80 if missing

        // 이동 가능한 타일인지 확인 (buffer 적용, check FEET position)
        if (!this.tileMap.isWalkableAtWorld(x, y + offset, 50)) return false

        // 플레이어와의 거리 확인
        const distToPlayer = Math.sqrt(
            Math.pow(x - playerPosition.x, 2) +
            Math.pow(y - playerPosition.y, 2)
        )

        return distToPlayer >= SAFE_DISTANCE_FROM_PLAYER
    }

    /**
     * 몬스터 생성
     */
    private createMonster(x: number, y: number, config: any): Monster | null {
        const monsterConfigs = config.monsters
        if (!monsterConfigs || monsterConfigs.length === 0) return null

        const mConfig = monsterConfigs[Math.floor(Math.random() * monsterConfigs.length)]
        const uniqueId = `mon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const monster = new Monster(uniqueId, x, y, mConfig)
        monster.setTileMap(this.tileMap)

        const monsterImage = this.resourceLoader.getImage(mConfig.id)
        if (monsterImage) monster.setSpriteImage(monsterImage)

        return monster
    }
}
