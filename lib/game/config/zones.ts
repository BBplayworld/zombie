import { PLAYER_ASSET_CONFIG } from './player';
import type { ZoneConfig, MapData, Vector2 } from './types'

/**
 * 챕터별 게임 설정
 * 각 챕터의 맵, 몬스터, 에셋 등을 정의
 */



import zone1MapDataConfig from '@/public/assets/zone-1/map/map-data.json';

// ============================================================================
// 챕터 설정 정의
// ============================================================================

export const ZONE_CONFIGS: Record<number, ZoneConfig> = {
    1: {
        id: 1,
        name: 'Zone 1: The Beginning',

        openWorldMapConfig: {
            worldSize: {
                width: 2048,
                height: 1024
            },
            walkableArea: {
                minX: -1024,
                maxX: 1024,
                minY: -512,
                maxY: 512
            },
            mapType: 'zone',
            portals: [
                /*
                {
                    x: 660, y: -200, width: 80, height: 400,
                    targetZoneId: 2, targetX: -500, targetY: 0
                }
                    */
            ]
        },

        // 게임플레이 설정
        gameplayConfig: {
            collisionYOffset: 80,

            // 몬스터 스폰 설정
            monsterConfig: {
                spawnCount: 15,
                regenTime: 60,
                autoAttack: false
            }
        },

        // 아이템 드랍 설정
        itemDropConfig: {
            globalDropRate: 0.3, // 30% 확률로 아이템 드랍
            rarities: {
                'Common': {
                    color: '#ffffff',
                    dropChance: 0.50, // 50%
                    optionCount: 1,
                    statRanges: {
                        flat: { min: 1, max: 10, chance: 1.0 },
                        percent: { min: 0.01, max: 0.05, chance: 0.2 } // 20% 확률로 퍼센트 옵션 붙음
                    }
                },
                'Uncommon': {
                    color: '#1eff00',
                    dropChance: 0.30, // 30%
                    optionCount: 2,
                    statRanges: {
                        flat: { min: 5, max: 20, chance: 1.0 },
                        percent: { min: 0.03, max: 0.08, chance: 0.5 }
                    }
                },
                'Rare': {
                    color: '#0070dd',
                    dropChance: 0.15, // 15%
                    optionCount: 3,
                    statRanges: {
                        flat: { min: 10, max: 40, chance: 1.0 },
                        percent: { min: 0.05, max: 0.12, chance: 0.8 }
                    }
                },
                'Epic': {
                    color: '#a335ee',
                    dropChance: 0.04, // 4%
                    optionCount: 4,
                    statRanges: {
                        flat: { min: 30, max: 80, chance: 1.0 },
                        percent: { min: 0.10, max: 0.20, chance: 1.0 }
                    }
                },
                'Legendary': {
                    color: '#ff8000',
                    dropChance: 0.01, // 1%
                    optionCount: 5,
                    statRanges: {
                        flat: { min: 50, max: 150, chance: 1.0 },
                        percent: { min: 0.15, max: 0.30, chance: 1.0 }
                    }
                }
            }
        },

        assetConfig: {
            ...PLAYER_ASSET_CONFIG,
            mapBackground: '/assets/zone-1/map/map.png'
        } as any,

        // 몬스터 종류별 상세 설정
        monsters: [
            {
                id: 'mon_1',
                name: 'Walker',
                imagePath: '/assets/zone-1/monster/mon-1.png',
                moveSpeed: 5,
                autoAttack: true,
                regenTime: 30,
                detectionRange: 200,
                stats: { Vigor: 10, Spirit: 5, Might: 10, Agility: 5, Luck: 5 }
            },
        ],

        // 맵 데이터 생성
        mapData: zone1MapDataConfig as MapData
    },
}

// ============================================================================
// 챕터 설정 접근 함수
// ============================================================================

/**
 * 챕터 설정 가져오기
 * @param zoneId 챕터 ID
 * @returns 챕터 설정 객체
 * @throws 챕터가 존재하지 않으면 에러
 */
export function getZoneConfig(zoneId: number): ZoneConfig {
    const config = ZONE_CONFIGS[zoneId]
    if (!config) {
        throw new Error(`Zone ${zoneId} not found`)
    }
    return config
}
