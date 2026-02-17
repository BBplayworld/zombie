import type { ChapterConfig, MapData, Vector2 } from './types'

/**
 * 챕터별 게임 설정
 * 각 챕터의 맵, 몬스터, 에셋 등을 정의
 */

// ============================================================================
// 챕터 1 맵 데이터 생성 함수
// ============================================================================

/**
 * 챕터 1 맵 데이터 생성
 * 이미지 맵 기반으로 동작하며, 이동 제약은 mapBoundary로 처리
 * @param width 맵 너비 (그리드 단위)
 * @param height 맵 높이 (그리드 단위)
 * @param ratio 이동 가능 타일 비율 (현재는 전체 이동 가능하므로 사용 안 함)
 */
function createChapter1MapData(width: number, height: number, ratio: number = 0.7): MapData {
    // Return a simple rectangular boundary for fallback
    const halfW = width / 2
    const halfH = height / 2

    // Clockwise rectangle
    const tiles = [
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: halfW, y: halfH },
        { x: -halfW, y: halfH }
    ]

    return {
        width,
        height,
        tiles,
        walkableTile: 'baseTile',
        startPosition: { x: 0, y: 0 }
    }
}

// ============================================================================
// 챕터 설정 정의
// ============================================================================

export const CHAPTER_CONFIGS: Record<number, ChapterConfig> = {
    1: {
        id: 1,
        name: 'Chapter 1: The Beginning',

        // 오픈 월드 맵 설정
        openWorldMapConfig: {
            // 오픈 월드 전체 크기 (map-1_3072.png 이미지 크기)
            worldSize: {
                width: 3072,
                height: 3072
            },

            // 이동 가능 영역 (벽 안쪽, 실제 플레이 가능한 영역)
            walkableArea: {
                minX: -1400,   // 왼쪽 벽 안쪽
                maxX: 1400,    // 오른쪽 벽 안쪽
                minY: -1400,   // 위쪽 벽 안쪽
                maxY: 1400     // 아래쪽 벽 안쪽
            },

            // 배경 타일 설정 (카메라 바깥 검정 부분 채우기용)
            backgroundTile: {
                width: 128,              // 타일 렌더링 너비
                height: 64,              // 타일 렌더링 높이
                ySpacingMultiplier: 0.7  // Y축 간격 배율
            },

            // 렌더링 옵션
            visibleMargin: 20,
            enableDepthSorting: true
        },

        // 게임플레이 설정
        gameplayConfig: {
            mapGenerationRatio: 0.7,
            baseSpeed: 8,
            collisionYOffset: 80,
            collisionAllowance: 0,
            enableIsoInput: true,

            // 몬스터 스폰 설정
            monsterConfig: {
                spawnCount: 15,
                regenTime: 60,
                autoAttack: false
            }
        },

        // 에셋 경로 설정
        assetConfig: {
            baseTile: '/assets/chapter-1/tile/basetile-1.png',
            backgroundTile: '/assets/chapter-1/tile/basetile-2.png',
            player: '/assets/chapter-1/player/player.png',
            fight: '/assets/chapter-1/player/fight.png',
            mapBackground: '/assets/chapter-1/map/map-1_3072.png'
        },

        // 몬스터 종류별 상세 설정
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

        // 맵 데이터 생성
        mapData: createChapter1MapData(200, 200, 0.7)
    }
}

// ============================================================================
// 챕터 설정 접근 함수
// ============================================================================

/**
 * 챕터 설정 가져오기
 * @param chapterId 챕터 ID
 * @returns 챕터 설정 객체
 * @throws 챕터가 존재하지 않으면 에러
 */
export function getChapterConfig(chapterId: number): ChapterConfig {
    const config = CHAPTER_CONFIGS[chapterId]
    if (!config) {
        throw new Error(`Chapter ${chapterId} not found`)
    }
    return config
}

/**
 * 현재 활성 챕터 관리 (추후 저장/로드 시스템과 연동)
 */
export const useChapter = () => {
    let currentChapterId = 1

    const getCurrentConfig = () => getChapterConfig(currentChapterId)

    const setChapter = (chapterId: number) => {
        currentChapterId = chapterId
    }

    return {
        get currentChapterId() {
            return currentChapterId
        },
        currentConfig: getCurrentConfig(),
        setChapter
    }
}
