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

export interface ChapterConfig {
    id: number
    name: string
    tileMapConfig: TileMapConfig
    mapData: MapData
}

/**
 * 챕터 1 맵 데이터 생성
 * 간단한 십자 형태의 길
 */
function createChapter1MapData(width: number, height: number): MapData {
    // 맵 초기화 (모두 이동 불가)
    const tiles: number[][] = Array(height).fill(0).map(() => Array(width).fill(0))

    // 십자 형태의 길 만들기 (중앙 가로/세로)
    const centerX = Math.floor(width / 2)
    const centerY = Math.floor(height / 2)

    // 가로 길 (중앙 행)
    for (let x = 0; x < width; x++) {
        tiles[centerY][x] = 1
        tiles[centerY - 1][x] = 1  // 2칸 너비
    }

    // 세로 길 (중앙 열)
    for (let y = 0; y < height; y++) {
        tiles[y][centerX] = 1
        tiles[y][centerX - 1] = 1  // 2칸 너비
    }

    return {
        width,
        height,
        tiles,
        walkableTile: 'baseTile',
        startPosition: { x: centerX, y: centerY }
    }
}

/**
 * 챕터별 설정 정의
 */
export const CHAPTER_CONFIGS: Record<number, ChapterConfig> = {
    1: {
        id: 1,
        name: 'Chapter 1: The Beginning',
        tileMapConfig: {
            sourceWidth: 1024,
            sourceHeight: 1024,
            tileWidth: 128,
            tileHeight: 64, // 2:1 비율 (평평한 바닥)
            ySpacingMultiplier: 0.7, // 시각적 보정값 (겹침 처리)
            overlapOffset: 0,
            visibleMargin: 20,
            enableDepthSorting: true,
        },
        // 맵 데이터 생성 (설정값 주입)
        mapData: createChapter1MapData(160, 160)
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
