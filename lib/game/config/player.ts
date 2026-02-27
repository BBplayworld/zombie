import { AssetConfig } from './types'

export const PLAYER_ASSET_CONFIG: Partial<AssetConfig> = {
    player: '/assets/main/player/player.png',
    // move 이미지: /assets/main/player/move/left.png, right.png (PlayerManager에서 직접 로드)
    // space 이펙트: /assets/main/player/skills/space/left.png, right.png (PlayerManager에서 직접 로드)
    window: '/assets/main/player/inventory.png',
    hpBar: '/assets/main/player/interface/hp.png',
    inventoryIcon: '/assets/main/player/interface/inventory.png'
}
