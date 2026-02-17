/**
 * 챕터별 맵 설정
 */

export interface TileMapConfig {
    // 타일 렌더링 설정
    sourceWidth: number
    sourceHeight: number
    tileWidth: number
    tileHeight: number
    ySpacingMultiplier: number
    overlapOffset: number
    visibleMargin: number
    enableDepthSorting: boolean
    mapBoundary?: {
        minX: number
        maxX: number
        minY: number
        maxY: number
    }
}

export interface MapData {
    // 맵 크기 (그리드 단위)
    width: number
    height: number

    // 타일 데이터 (0: 이동 불가, 1: 이동 가능)
    tiles: number[][]

    // 타일 이미지 매핑
    walkableTile: string  // 이동 가능한 타일 이미지 키

    // 플레이어 시작 위치 (그리드 좌표)
    startPosition: { x: number; y: number }
}

export interface GameplayConfig {
    // 맵 생성 관련
    mapGenerationRatio: number // 바닥 생성 비율 (0.0 ~ 1.0). 높을수록 바닥이 많아짐.

    // 캐릭터 이동 속도
    baseSpeed: number

    // 캐릭터 이동 충돌 판정 관련 (미세 조정)

    // 1. 발바닥 Y 오프셋 (단위: px)
    // 캐릭터의 중심(배꼽)에서 얼마만큼 아래를 '발바닥'으로 볼 것인가.
    // 값이 클수록 캐릭터의 판정 위치가 아래로 내려감. 즉 캐릭터 그림은 상대적으로 위로 올라가 보임.
    // - 상단이 걸린다 -> 값을 줄여야 함
    // - 하단이 뚫린다 -> 값을 키워야 함
    collisionYOffset: number

    // 2. 충돌 허용 범위 (단위: 그리드 칸 수, 기본 0)
    // 벽이라도 주변 N칸 이내에 바닥이 있으면 이동을 허용할지 여부.
    // 값이 1 이상이면 얇은 벽(1칸)을 통과해버리는 부작용이 있음.
    // 이동 불가 타일 허용 범위 (주변 N칸)
    collisionAllowance?: number

    // 3. 아이소메트릭 입력 변환 (기본: false)
    // true일 경우: 방향키 입력이 다이아몬드 맵 축에 맞춰 변환됨 (예: 왼쪽 키 -> 좌하단 이동)
    // false일 경우: 방향키 입력 그대로 화면 상하좌우 이동
    enableIsoInput?: boolean

    // 몬스터 설정
    monsterConfig?: MonsterConfig
}

export interface MonsterConfig {
    spawnCount: number        // 맵에 존재하는 최대 몬스터 수
    regenTime: number         // 처치 후 리젠 시간 (초)
    autoAttack: boolean       // 플레이어 자동 공격 여부
}

export interface AssetConfig {
    baseTile: string
    backgroundTile: string
    player: string
    fight: string
    mapBackground: string // Add mapBackground
}

export interface MonsterDetailConfig {
    id: string           // 리소스 로드 키로도 사용 (예: 'mon_1')
    name: string
    imagePath: string
    moveSpeed: number
    autoAttack: boolean
    regenTime: number    // 초 단위
    detectionRange: number
}

export interface ChapterConfig {
    id: number
    name: string
    tileMapConfig: TileMapConfig
    gameplayConfig: GameplayConfig
    mapData: MapData
    assetConfig: AssetConfig
    monsters: MonsterDetailConfig[]
}

/**
 * 챕터별 설정 정의
 */
export const CHAPTER_CONFIGS: Record<number, ChapterConfig> = {
    1: {
        id: 1,
        name: 'Chapter 1: The Beginning',
        tileMapConfig: {
            sourceWidth: 3072,
            sourceHeight: 3072,
            tileWidth: 128,
            tileHeight: 64, // 2:1 비율 (평평한 바닥)
            ySpacingMultiplier: 0.7, // 시각적 보정값 (겹침 처리)
            overlapOffset: 0,
            visibleMargin: 20,
            enableDepthSorting: true,
            // 맵 이동 제한 (이미지 기준)
            mapBoundary: {
                minX: -1536,
                maxX: 1536,
                minY: -1536,
                maxY: 1536
            }
        },
        gameplayConfig: {
            mapGenerationRatio: 0.7, // 맵의 70%를 바닥으로 생성
            baseSpeed: 8,           // 캐릭터 기본 이동 속도
            collisionYOffset: 80,    // 충돌 판정 오프셋
            collisionAllowance: 0,   // 이동 불가 타일 허용 범위
            enableIsoInput: true,     // 아이소메트릭 입력 변환 켜기
            monsterConfig: {          // 전역 몬스터 스폰 설정
                spawnCount: 15,
                regenTime: 60,
                autoAttack: false
            }
        },
        assetConfig: {
            baseTile: '/assets/chapter-1/tile/basetile-1.png',
            backgroundTile: '/assets/chapter-1/tile/basetile-2.png',
            player: '/assets/chapter-1/player/player.png',
            fight: '/assets/chapter-1/player/fight.png',
            mapBackground: '/assets/chapter-1/map/map-1_3072.png' // New map image
        },
        monsters: [
            {
                id: 'mon_1',
                name: 'Walker',
                imagePath: '/assets/chapter-1/monster/mon-1.png',
                moveSpeed: 3,
                autoAttack: false,
                regenTime: 30,
                detectionRange: 150
            },
            {
                id: 'mon_2',
                name: 'Runner',
                imagePath: '/assets/chapter-1/monster/mon-2.png',
                moveSpeed: 6,
                autoAttack: true,
                regenTime: 45,
                detectionRange: 200
            },
            {
                id: 'mon_3',
                name: 'Tank',
                imagePath: '/assets/chapter-1/monster/mon-3.png',
                moveSpeed: 2,
                autoAttack: true,
                regenTime: 60,
                detectionRange: 100
            },
            {
                id: 'mon_4',
                name: 'Ghost',
                imagePath: '/assets/chapter-1/monster/mon-2.png',
                moveSpeed: 4,
                autoAttack: false,
                regenTime: 40,
                detectionRange: 180
            },
            {
                id: 'mon_5',
                name: 'Boss',
                imagePath: '/assets/chapter-1/monster/mon-3.png',
                moveSpeed: 5,
                autoAttack: true,
                regenTime: 120,
                detectionRange: 300
            }
        ],
        // 맵 데이터 생성 (설정값 주입)
        mapData: createChapter1MapData(200, 200, 0.7)
    }
}

/**
 * 챕터 1 맵 데이터 생성
 * 이미지 맵(@/assets/chapter-1/map/map-1.png)에 맞춘 맵 데이터 생성
 * 이동 제약은 mapBoundary로 처리하므로, 그리드 맵은 전체 이동 가능(1)으로 설정.
 */
function createChapter1MapData(width: number, height: number, ratio: number = 0.7): MapData {
    // 1: Walkable
    const tiles: number[][] = Array(height).fill(0).map(() => Array(width).fill(1))

    // 그리드 상의 벽은 모두 제거 (boundary 사용)

    const centerX = Math.floor(width / 2)
    const centerY = Math.floor(height / 2)

    return {
        width,
        height,
        tiles,
        walkableTile: 'baseTile',
        startPosition: { x: centerX, y: centerY }
    }
}

/**
 * 현재 챕터 설정 가져오기
 */
export function getChapterConfig(chapterId: number): ChapterConfig {
    const config = CHAPTER_CONFIGS[chapterId]
    if (!config) {
        throw new Error(`Chapter ${chapterId} not found`)
    }
    return config
}

/**
 * 현재 활성 챕터 (추후 저장/로드 시스템과 연동)
 */
export const useChapter = () => {
    const currentChapterId = ref(1)

    const currentConfig = computed(() => getChapterConfig(currentChapterId.value))

    const setChapter = (chapterId: number) => {
        currentChapterId.value = chapterId
    }

    return {
        currentChapterId,
        currentConfig,
        setChapter
    }
}
