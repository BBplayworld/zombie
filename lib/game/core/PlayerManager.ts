import { Player } from '../entities/Player'
import { Monster } from '../entities/Monster'
import { ItemDrop } from '../entities/ItemDrop'
import { Item } from '../entities/Item'
import { TileMap } from '../systems/TileMap'
import { InputManager } from '../systems/InputManager'
import { ResourceLoader } from '../systems/ResourceLoader'
import { InventoryManager } from './InventoryManager'
import { InterfaceManager } from './InterfaceManager'

/**
 * 플레이어 관련 로직을 전담하는 매니저
 *
 * 담당 범위:
 *  - 플레이어 스프라이트/타일맵 초기화
 *  - 매 프레임 입력 처리 (이동 / 공격)
 *  - HP 자동 회복 및 몬스터 반격 데미지 수신
 *  - 아이템 획득 (근접 자동 줍기)
 *  - 인벤토리 / 아이콘 hover 커서 처리
 *  - 몬스터 공격 실행 (handleAttack)
 */
export class PlayerManager {
    readonly player: Player

    private tileMap: TileMap
    private resourceLoader: ResourceLoader
    private inventoryManager: InventoryManager
    private interfaceManager: InterfaceManager
    private canvas: HTMLCanvasElement

    // 공격 사거리 (px)
    private static readonly ATTACK_RANGE = 250
    // 아이템 자동 줍기 거리 (px)
    private static readonly ITEM_PICK_RANGE = 50

    constructor(
        player: Player,
        tileMap: TileMap,
        resourceLoader: ResourceLoader,
        inventoryManager: InventoryManager,
        interfaceManager: InterfaceManager,
        canvas: HTMLCanvasElement
    ) {
        this.player = player
        this.tileMap = tileMap
        this.resourceLoader = resourceLoader
        this.inventoryManager = inventoryManager
        this.interfaceManager = interfaceManager
        this.canvas = canvas
    }

    // ─────────────────────────────────────────────────────
    //  초기화
    // ─────────────────────────────────────────────────────

    /**
     * 스프라이트 & 타일맵 연결 (loadResources 이후 호출)
     */
    initialize(): void {
        this.player.setTileMap(this.tileMap)

        const playerSprite = this.resourceLoader.getImage('player')
        if (playerSprite) this.player.setSpriteImage(playerSprite)

        const fightSprite = this.resourceLoader.getImage('fight')
        if (fightSprite) this.player.setFightImage(fightSprite)

        const helmetSprite = this.resourceLoader.getImage('helmet')
        if (helmetSprite) this.player.setHelmetImage(helmetSprite)

        console.log('  ✅ [PlayerManager] Player initialized')
    }

    // ─────────────────────────────────────────────────────
    //  매 프레임 업데이트
    // ─────────────────────────────────────────────────────

    /**
     * 매 프레임 호출 — 입력/물리/UI 처리
     * @param deltaTime 초 단위 델타
     * @param inputManager 현재 프레임 입력 상태
     * @param items 월드 아이템 목록 (자동 줍기 후 필터링된 새 배열 반환)
     * @param monsters 모든 몬스터 (반격 데미지 체크용)
     */
    update(
        deltaTime: number,
        inputManager: InputManager,
        items: ItemDrop[],
        monsters: Monster[]
    ): ItemDrop[] {
        // 1. 이동 입력
        const input = inputManager.getMovementInput()
        this.player.move(input.x, input.y)

        // 2. 플레이어 물리/애니메이션 업데이트 (HP 회복 포함)
        this.player.update(deltaTime)

        // 3. 반격 중인 몬스터 → 플레이어 피해
        this.applyCounterAttackDamage(monsters)

        // 4. 아이템 자동 줍기
        const remaining = this.pickUpItems(items)

        // 5. 인벤토리 / 아이콘 커서 처리
        this.handleCursor(inputManager)

        return remaining
    }

    // ─────────────────────────────────────────────────────
    //  공격
    // ─────────────────────────────────────────────────────

    /**
     * Space 키 공격 실행 — 범위 내 몬스터에게 데미지 + 넉백
     * @returns 공격이 실제로 히트한 몬스터 수
     */
    handleAttack(monsters: Monster[]): number {
        this.player.attack()
        let hits = 0

        monsters.forEach(monster => {
            if (monster.isDead) return

            const dx = monster.position.x - this.player.position.x
            const dy = monster.position.y - this.player.position.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist <= PlayerManager.ATTACK_RANGE) {
                const { amount, isCrit } = this.player.getDamage()
                const counterFired = monster.takeDamage(amount)

                const pushPower = 50 + (isCrit ? 30 : 0)
                monster.pushFrom(this.player.position.x, this.player.position.y, pushPower)

                const hitTag = isCrit ? 'CRITICAL HIT!' : 'Hit'
                console.log(`${hitTag} monster ${monster.id}! DMG: ${amount}, HP: ${monster.hp}${counterFired ? ' [COUNTER!]' : ''}`)
                hits++
            }
        })

        return hits
    }

    // ─────────────────────────────────────────────────────
    //  내부 헬퍼
    // ─────────────────────────────────────────────────────

    /** 반격 중인 몬스터 → 플레이어 피해 적용 */
    private applyCounterAttackDamage(monsters: Monster[]): void {
        monsters.forEach(monster => {
            const dmg = monster.tryCounterAttack(this.player.position.x, this.player.position.y)
            if (dmg > 0) {
                this.player.takeDamage(dmg)
                console.log(`Monster ${monster.id} counter-attacked! Player HP: ${Math.ceil(this.player.hp)}`)
            }
        })
    }

    /** 근접 아이템 자동 줍기, 획득된 아이템 제거 후 남은 목록 반환 */
    private pickUpItems(items: ItemDrop[]): ItemDrop[] {
        return items.filter(item => {
            const dx = this.player.position.x - item.position.x
            const dy = this.player.position.y - item.position.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < PlayerManager.ITEM_PICK_RANGE) {
                console.log(`Item collected: ${item.data.name} (${item.data.rarity})`)
                this.player.addItem(item.data)
                item.isCollected = true
                return false
            }
            return true
        })
    }

    /** 인벤토리 open/close 상태에 따른 커서 처리 */
    private handleCursor(inputManager: InputManager): void {
        if (this.player.isInventoryOpen) {
            this.inventoryManager.handleHover(inputManager)
        } else {
            const mousePos = inputManager.getMousePosition()
            const rect = this.canvas.getBoundingClientRect()
            const mx = mousePos.x - rect.left
            const my = mousePos.y - rect.top
            this.interfaceManager.handleHover(mx, my)
            this.player.hoveredItem = null
        }
    }

    // ─────────────────────────────────────────────────────
    //  인벤토리 토글 (키/아이콘 클릭 공통)
    // ─────────────────────────────────────────────────────

    toggleInventory(): void {
        this.player.toggleInventory()
        this.player.hoveredItem = null
        this.canvas.style.cursor = 'default'
        if (this.player.isInventoryOpen) {
            this.player.inventoryMenu = null
        }
    }
}
