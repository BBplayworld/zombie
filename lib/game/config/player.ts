import { AssetConfig } from './types'

export const PLAYER_ASSET_CONFIG: Partial<AssetConfig> = {
    character_player: '/assets/main/player/action/move-right.png',
    interface_window: '/assets/main/player/inventory.png',
    interface_hpBar: '/assets/main/player/interface/hp.png',
    interface_inventoryIcon: '/assets/main/player/interface/inventory.png',
    interface_skill_q: '/assets/main/player/interface/skills/q.jpg',
    interface_skill_w: '/assets/main/player/interface/skills/w.jpg',
    interface_skill_e: '/assets/main/player/interface/skills/e.jpg',
    interface_skill_r: '/assets/main/player/interface/skills/r.jpg',
    // ── 아이템 6부위 ────────────────────────────────────────────
    item_helmet: '/assets/main/item/helmet.png',
    item_armor: '/assets/main/item/armor.png',
    item_weapon: '/assets/main/item/weapon.png',
    item_shield: '/assets/main/item/shield.png',
    item_boots: '/assets/main/item/boots.png',
    item_ring: '/assets/main/item/ring.png',
}

/**
 * 아이템 스프라이트 시트 그리드 설정
 * 문자열 값: `cols x rows` (스프라이트 시트일 경우), `1x1` (단일 이미지)
 * 
 * 현재 helmet/armor/weapon은 sprite sheet(4x3) 사용 중
 * shield/boots/ring은 단일 이미지 (형식: 1x1)
 */
export const ITEM_SPRITE_GRID: Record<string, { cols: number; rows: number; frameIndex: number; insetX?: number; insetY?: number }> = {
    item_helmet: { cols: 4, rows: 4, frameIndex: 0, insetX: 80, insetY: 80 },  // 4열3라인 sprite sheet, 첫 프레임
    item_armor: { cols: 4, rows: 4, frameIndex: 0, insetX: 10 },
    item_weapon: { cols: 4, rows: 4, frameIndex: 0, insetX: 70, insetY: 70 },
    item_shield: { cols: 1, rows: 1, frameIndex: 0 },
    item_boots: { cols: 1, rows: 1, frameIndex: 0 },
    item_ring: { cols: 4, rows: 4, frameIndex: 0, insetX: 15, insetY: 15 },
}
