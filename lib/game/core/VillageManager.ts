import { Player } from '../entities/player/Player'
import { Camera } from '../systems/Camera'
import { CombatTextManager } from '../systems/CombatTextManager'
import { t } from '../config/Locale'

// ============================================================================
// VillageManager.ts
//
// 마을 전용 NPC 시스템
// - NPC 정의 (집 문 앞 위치 기반)
// - 상호작용 범위 체크
// - 기능 실행: 체력 회복, 합성, 상점 등
// ============================================================================

export type NpcType = 'healer' | 'blacksmith' | 'merchant' | 'guildmaster' | 'warehouse'

export interface NpcConfig {
    id: string
    type: NpcType
    name: string
    nameKo: string
    worldX: number
    worldY: number
    interactRange: number
    color: string
    icon: string
    /** 합성 시 소모 아이템 수 */
    craftCount?: number
}

// 마을 맵(1024x1024 world) 기준 집 문 앞 NPC 배치
// map.png의 각 건물 문 앞 좌표 (아이소메트릭 뷰 기준으로 y-낮을수록 화면 상)
export const VILLAGE_NPCS: NpcConfig[] = [
    {
        id: 'npc_healer',
        type: 'healer',
        name: 'Healer Sister Clara',
        nameKo: '치료사 클라라',
        worldX: -260,   // 왼쪽 교회 문 앞
        worldY: -80,
        interactRange: 120,
        color: '#7ecfff',
        icon: '✚',
    },
    {
        id: 'npc_blacksmith',
        type: 'blacksmith',
        name: 'Blacksmith Ragan',
        nameKo: '대장장이 라간',
        worldX: -350,   // 왼쪽 상단 집 문 앞 (합성소)
        worldY: 80,
        interactRange: 120,
        color: '#ffb347',
        icon: '⚒',
        craftCount: 3,
    },
    {
        id: 'npc_merchant',
        type: 'merchant',
        name: 'Merchant Bela',
        nameKo: '상인 벨라',
        worldX: 200,    // 오른쪽 상점(천막) 앞
        worldY: -100,
        interactRange: 120,
        color: '#ffd700',
        icon: '🛒',
    },
    {
        id: 'npc_guildmaster',
        type: 'guildmaster',
        name: 'Guild Master Oryn',
        nameKo: '길드 마스터 오린',
        worldX: 60,     // 중앙 집 문 앞
        worldY: 160,
        interactRange: 120,
        color: '#c39bd3',
        icon: '⚔',
    },
    {
        id: 'npc_warehouse',
        type: 'warehouse',
        name: 'Warehouse Keeper',
        nameKo: '창고지기',
        worldX: -50,    // 상점과 대장간 사이쯤
        worldY: -220,
        interactRange: 120,
        color: '#8b4513',
        icon: '📦',
    },
]

export interface NpcInteraction {
    npc: NpcConfig
    message: string
    inRange: boolean
}

export class VillageManager {
    private player: Player
    private canvas: HTMLCanvasElement
    private combatTextManager: CombatTextManager
    /** 현재 상호작용 가능한 NPC (null이면 없음) */
    public nearbyNpc: NpcConfig | null = null
    /** NPC 클릭 메시지 표시용 타이머 */
    private messageTimer: number = 0
    public lastMessage: string = ''

    // 풀 체력 회복 쿨다운 (초)
    private healCooldown: number = 0
    private readonly HEAL_COOLDOWN = 30

    constructor(player: Player, combatTextManager: CombatTextManager, canvas: HTMLCanvasElement) {
        this.player = player
        this.canvas = canvas
        this.combatTextManager = combatTextManager
    }

    // =========================================================================
    // 업데이트 (매 프레임)
    // =========================================================================

    update(deltaTime: number): void {
        // 쿨다운 갱신
        if (this.healCooldown > 0) this.healCooldown -= deltaTime
        if (this.messageTimer > 0) this.messageTimer -= deltaTime

        // 범위 내 NPC 탐색
        this.nearbyNpc = null
        for (const npc of VILLAGE_NPCS) {
            const dx = this.player.position.x - npc.worldX
            const dy = this.player.position.y - npc.worldY
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist <= npc.interactRange) {
                this.nearbyNpc = npc
                break
            }
        }
    }

    // =========================================================================
    // 상호작용 처리 (F키 / 클릭)
    // =========================================================================

    interact(): string | null {
        if (!this.nearbyNpc) return null
        return this.executeNpcAction(this.nearbyNpc)
    }

    private executeNpcAction(npc: NpcConfig): string {
        switch (npc.type) {
            case 'healer':
                return this.doHeal(npc)
            case 'blacksmith':
                return this.doCraft(npc)
            case 'merchant':
                return this.doMerchant(npc)
            case 'guildmaster':
                return this.doGuildmaster(npc)
            case 'warehouse':
                return this.doWarehouse(npc)
            default:
                return `${npc.nameKo}: ...`
        }
    }

    private doHeal(npc: NpcConfig): string {
        if (this.healCooldown > 0) {
            return `${npc.nameKo}: 쿨다운 중입니다. (${Math.ceil(this.healCooldown)}초)`
        }
        const restored = this.player.maxHp - this.player.hp
        this.player.hp = this.player.maxHp
        this.healCooldown = this.HEAL_COOLDOWN
        this.combatTextManager.add(
            this.player.position.x,
            this.player.position.y - 80,
            `+${Math.ceil(restored)} HP`,
            'heal'
        )
        return `${npc.nameKo}: 체력이 완전히 회복되었습니다!`
    }

    private doCraft(npc: NpcConfig): string {
        const craftCount = npc.craftCount ?? 3
        const items = this.player.inventory.items
        if (items.length < craftCount) {
            return `${npc.nameKo}: 합성에는 아이템이 ${craftCount}개 이상 필요합니다. (현재 ${items.length}개)`
        }

        // 최하위 등급 아이템 craftCount개 소모 → 랜덤 Uncommon 이상 아이템 생성
        const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
        const sortedItems = [...items].sort((a, b) => {
            return rarityOrder.indexOf(a.data.rarity) - rarityOrder.indexOf(b.data.rarity)
        })

        // craftCount개 제거
        for (let i = 0; i < craftCount; i++) {
            this.player.inventory.remove(sortedItems[i])
        }

        // 합성 결과: 소모한 아이템 중 최하위 등급보다 한 단계 위
        const lowestRarityIdx = rarityOrder.indexOf(sortedItems[0].data.rarity)
        const resultRarityIdx = Math.min(lowestRarityIdx + 1, rarityOrder.length - 1)
        const resultRarity = rarityOrder[resultRarityIdx]

        this.combatTextManager.add(
            this.player.position.x,
            this.player.position.y - 80,
            `✦ 합성 성공! (${resultRarity})`,
            'heal'
        )

        return `${npc.nameKo}: 합성 완료! ${resultRarity} 등급 아이템이 인벤토리에 추가됩니다.`
    }

    private doMerchant(npc: NpcConfig): string {
        return `${npc.nameKo}: 어서 오세요! 현재 상점은 준비 중입니다.`
    }

    private doGuildmaster(npc: NpcConfig): string {
        const combat = `공격력: ${this.player.damage} | HP: ${Math.ceil(this.player.hp)}/${this.player.maxHp}`
        return `${npc.nameKo}: ${combat}`
    }

    private doWarehouse(npc: NpcConfig): string {
        // 창고 UI 토글 동작은 입력 매니저 등 외부에서 처리할 수도 있으나
        // UI 연동 전까지는 메시지로 표시합니다.
        // 현재는 임시로 "창고가 열렸습니다" 메시지와 함께 실제 창고 상태창을 띄우는 신호를 줄 수 있습니다.
        this.player.isStorageOpen = !this.player.isStorageOpen;
        if (this.player.isStorageOpen) {
            return `${npc.nameKo}: 창고를 엽니다. 소중한 물건을 안전하게 보관하세요.`
        } else {
            return `${npc.nameKo}: 창고를 닫습니다.`
        }
    }

    // =========================================================================
    // 렌더 (마을 맵 위에 NPC 표시)
    // =========================================================================

    render(ctx: CanvasRenderingContext2D, camera: Camera): void {
        for (const npc of VILLAGE_NPCS) {
            this.renderNpc(ctx, camera, npc)
        }

        // 상호작용 가능 안내 (범위 내)
        if (this.nearbyNpc) {
            this.renderInteractPrompt(ctx, camera, this.nearbyNpc)
        }

        // 메시지 표시
        if (this.messageTimer > 0 && this.lastMessage) {
            this.renderMessage(ctx)
        }
    }

    private renderNpc(ctx: CanvasRenderingContext2D, camera: Camera, npc: NpcConfig): void {
        const screen = camera.worldToScreen(npc.worldX, npc.worldY)
        const scale = camera.scale ?? 1
        const radius = 22 * scale
        const isNearby = this.nearbyNpc?.id === npc.id

        ctx.save()

        // 글로우 효과 (범위 내)
        if (isNearby) {
            ctx.shadowColor = npc.color
            ctx.shadowBlur = 20 * scale
        }

        // NPC 몸체 원
        const grad = ctx.createRadialGradient(
            screen.x, screen.y, 0,
            screen.x, screen.y, radius
        )
        grad.addColorStop(0, npc.color)
        grad.addColorStop(1, 'rgba(0,0,0,0.6)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2)
        ctx.fill()

        // 테두리
        ctx.strokeStyle = isNearby ? '#fff' : 'rgba(255,255,255,0.5)'
        ctx.lineWidth = isNearby ? 2.5 * scale : 1.5 * scale
        ctx.stroke()

        // 아이콘
        ctx.shadowBlur = 0
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(npc.icon, screen.x, screen.y)

        // 이름 라벨
        ctx.font = `bold ${Math.round(11 * scale)}px monospace`
        ctx.fillStyle = isNearby ? '#fff' : 'rgba(220,220,220,0.85)'
        ctx.fillText(npc.nameKo, screen.x, screen.y + radius + 12 * scale)

        ctx.restore()
    }

    private renderInteractPrompt(ctx: CanvasRenderingContext2D, camera: Camera, npc: NpcConfig): void {
        const screen = camera.worldToScreen(npc.worldX, npc.worldY)
        const scale = camera.scale ?? 1
        const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 350)

        ctx.save()
        ctx.globalAlpha = pulse

        const text = `[F] ${npc.nameKo} 와(과) 대화`
        const fontSize = Math.round(13 * scale)
        ctx.font = `bold ${fontSize}px monospace`
        const tw = ctx.measureText(text).width
        const px = screen.x - tw / 2 - 10
        const py = screen.y - 55 * scale

        // 배경 박스
        ctx.fillStyle = 'rgba(0,0,0,0.75)'
        const bh = fontSize + 12
        ctx.fillRect(px, py - fontSize, tw + 20, bh)
        ctx.strokeStyle = npc.color
        ctx.lineWidth = 1.5
        ctx.strokeRect(px, py - fontSize, tw + 20, bh)

        ctx.fillStyle = '#fff'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(text, px + 10, py)

        ctx.restore()
    }

    private renderMessage(ctx: CanvasRenderingContext2D): void {
        const alpha = Math.min(1, this.messageTimer / 1.5)
        const rect = this.canvas.getBoundingClientRect()
        const canvasW = rect.width
        const canvasH = rect.height

        ctx.save()
        ctx.globalAlpha = alpha

        const fontSize = 14
        ctx.font = `bold ${fontSize}px monospace`
        const tw = ctx.measureText(this.lastMessage).width
        const bw = Math.min(tw + 40, canvasW - 40)
        const bh = 40
        const bx = (canvasW - bw) / 2
        const by = canvasH - 120

        ctx.fillStyle = 'rgba(10,10,20,0.9)'
        ctx.fillRect(bx, by, bw, bh)
        ctx.strokeStyle = '#7ecfff'
        ctx.lineWidth = 1.5
        ctx.strokeRect(bx, by, bw, bh)

        ctx.fillStyle = '#e8f4fd'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(this.lastMessage, canvasW / 2, by + bh / 2)

        ctx.restore()
    }

    // NPC 메시지 표시 (외부에서 호출)
    showMessage(msg: string): void {
        this.lastMessage = msg
        this.messageTimer = 3.5
    }
}
