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
    ZoneMapConfig,
    MapData,
    GameplayConfig,
    MonsterSpawnConfig,
    AssetConfig,
    MonsterDetailConfig,
    PlayerConfig,
    ZoneConfig
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
    ZONE_CONFIGS,
    getZoneConfig,
} from './zones'

export { Player } from '../entities/player/Player'