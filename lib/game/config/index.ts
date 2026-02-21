/**
 * 게임 설정 모듈 통합 Export
 * 모든 설정 관련 타입과 함수를 한 곳에서 import 가능
 */

// 타입 정의
export type {
    Vector2,
    Boundary,
    IEntity,
    ICombatEntity,
    TileMapConfig,
    MapData,
    GameplayConfig,
    MonsterSpawnConfig,
    AssetConfig,
    MonsterDetailConfig,
    PlayerConfig,
    ChapterConfig
} from './types'

// 상수
export {
    RENDERING,
    MOVEMENT,
    SPRITE,
    AI,
    GAME_LOOP,
    UI
} from './constants'

// 챕터 설정
export {
    CHAPTER_CONFIGS,
    getChapterConfig,
    useChapter
} from './chapters'

// 플레이어 설정은 entities/Player.ts 내 상수로 통합됨 (BASE_SPEED 등)