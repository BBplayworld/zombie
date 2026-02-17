/**
 * 게임 전체에서 사용하는 공통 타입 정의
 * 모든 엔티티(플레이어, 몬스터)가 공유하는 인터페이스
 */

// ============================================================================
// 기본 타입
// ============================================================================

export interface Vector2 {
    x: number
    y: number
}

export interface Boundary {
    minX: number
    maxX: number
    minY: number
    maxY: number
}

// ============================================================================
// 엔티티 공통 인터페이스
// ============================================================================

/**
 * 게임 내 모든 움직이는 객체(플레이어, 몬스터)의 공통 인터페이스
 * 이를 통해 동일한 로직으로 처리 가능
 */
export interface IEntity {
    // 기본 속성
    id: string
    position: Vector2
    velocity: Vector2
    width: number
    height: number
    speed: number

    // 상태
    isMoving: boolean
    direction: 'idle' | 'up' | 'down' | 'left' | 'right'

    // 메서드
    update(deltaTime: number): void
    render(ctx: CanvasRenderingContext2D, camera: any): void
}

/**
 * 전투 가능한 엔티티 인터페이스
 */
export interface ICombatEntity extends IEntity {
    isAttacking: boolean
    isDead: boolean
    health: number
    maxHealth: number
    attack(): void
    takeDamage(amount: number): void
}

// ============================================================================
// 타일맵 관련 타입
// ============================================================================

/**
 * 오픈 월드 맵 설정
 * 전체 맵은 단일 이미지로 렌더링되며, 타일은 카메라 바깥 배경 채우기용
 */
export interface OpenWorldMapConfig {
    // 오픈 월드 전체 크기 (맵 이미지 크기)
    worldSize: {
        width: number   // 전체 월드 너비 (픽셀)
        height: number  // 전체 월드 높이 (픽셀)
    }

    // 이동 가능 영역 (벽 안쪽, 플레이어/몬스터가 접근 가능한 영역)
    walkableArea: Boundary

    // 배경 타일 설정 (카메라 바깥 검정 부분 채우기용)
    backgroundTile: {
        width: number              // 타일 렌더링 너비
        height: number             // 타일 렌더링 높이
        ySpacingMultiplier: number // Y축 간격 배율
    }

    // 렌더링 옵션
    visibleMargin: number      // 화면 밖 여유 렌더링 범위
    enableDepthSorting: boolean // 깊이 정렬 활성화

    // @deprecated - 하위 호환용
    mapBoundary?: Boundary
    overlapOffset?: number
}

// 하위 호환성을 위한 별칭
export type TileMapConfig = OpenWorldMapConfig


export interface MapData {
    width: number
    height: number
    tiles: Vector2[]  // Boundary coordinates (polygon)
    walkableTile: string
    startPosition: Vector2
}

// ============================================================================
// 게임플레이 설정 타입
// ============================================================================

export interface GameplayConfig {
    // 맵 생성
    mapGenerationRatio: number

    // 이동 속도
    baseSpeed: number

    // 충돌 판정
    collisionYOffset: number
    collisionAllowance: number
    enableIsoInput: boolean

    // 몬스터 설정
    monsterConfig: MonsterSpawnConfig
}

export interface MonsterSpawnConfig {
    spawnCount: number      // 맵에 존재하는 최대 몬스터 수
    regenTime: number       // 처치 후 리젠 시간 (초)
    autoAttack: boolean     // 플레이어 자동 공격 여부
}

// ============================================================================
// 에셋 설정 타입
// ============================================================================

export interface AssetConfig {
    baseTile: string
    backgroundTile: string
    player: string
    fight: string
    mapBackground: string
}

// ============================================================================
// 몬스터 상세 설정 타입
// ============================================================================

export interface MonsterDetailConfig {
    id: string
    name: string
    imagePath: string
    moveSpeed: number
    autoAttack: boolean
    regenTime: number
    detectionRange: number
}

// ============================================================================
// 챕터 설정 타입
// ============================================================================

export interface ChapterConfig {
    id: number
    name: string
    openWorldMapConfig: OpenWorldMapConfig
    gameplayConfig: GameplayConfig
    mapData: MapData
    assetConfig: AssetConfig
    monsters: MonsterDetailConfig[]
}
