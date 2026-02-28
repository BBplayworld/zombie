import { Camera } from '../systems/Camera'
import { Player } from '../entities/player/Player'
import { Monster } from '../entities/monster/Monster'
import { ItemDrop } from '../entities/ItemDrop'
import { ZoneMap } from '../systems/ZoneMap'
import { ResourceLoader } from '../systems/ResourceLoader'
import { InventoryManager } from './InventoryManager'
import { InterfaceManager } from './InterfaceManager'
import { MiniMap } from '../systems/MiniMap'
import { CombatTextManager } from '../systems/CombatTextManager'

/**
 * 렌더링 관리 클래스
 * 하단 HUD(HP바·인벤토리 아이콘)는 InterfaceManager에 위임
 */
export class RenderManager {
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private resourceLoader: ResourceLoader
    private miniMap: MiniMap
    readonly interfaceManager: InterfaceManager

    private fps: number = 0
    private frameCount: number = 0
    private fpsUpdateTime: number = 0



    constructor(canvas: HTMLCanvasElement, resourceLoader: ResourceLoader) {
        this.canvas = canvas
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get 2D context')
        this.ctx = ctx
        this.resourceLoader = resourceLoader
        this.miniMap = new MiniMap(canvas)
        this.interfaceManager = new InterfaceManager(canvas)
    }

    getMiniMap(): MiniMap {
        return this.miniMap
    }

    updateFPS(currentTime: number): void {
        this.frameCount++
        if (currentTime - this.fpsUpdateTime >= 1000) {
            this.fps = this.frameCount
            this.frameCount = 0
            this.fpsUpdateTime = currentTime
        }
    }

    render(
        ZoneMap: ZoneMap,
        camera: Camera,
        player: Player,
        monsters: Monster[],
        items: ItemDrop[],
        gameState: string,
        inventoryManager: InventoryManager,
        combatTextManager: CombatTextManager
    ): void {
        this.clearScreen()
        this.ctx.save()

        // 1. 타일맵
        ZoneMap.render(this.ctx, camera)

        // 2. 엔티티 (Y축 정렬)
        this.renderEntities(player, monsters, items, camera)

        // 데미지 텍스트
        combatTextManager.render(this.ctx, camera)

        this.ctx.restore()

        // 3. UI (인벤토리 → 미니맵 → HUD 순)
        // 맵 이미지의 스크린 좌표를 계산해서 모든 UI의 기준점으로 사용
        const mapRect = ZoneMap.getMapScreenRect(camera)
        this.renderUI(player, camera, gameState, inventoryManager, monsters, mapRect)

        // 4. 피격 화면 비네트 (UI 위에 그려 항상 최상단 표시)
        if (player.isDamaged) {
            this.renderHitVignette()
        }
    }

    private clearScreen(): void {
        this.ctx.fillStyle = '#000'
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }

    private renderEntities(player: Player, monsters: Monster[], items: ItemDrop[], camera: Camera): void {
        const entities: (Player | Monster | ItemDrop)[] = [...items, player, ...monsters]
        entities.sort((a, b) => a.position.y - b.position.y)

        const playerImage = this.resourceLoader.getImage('player')

        entities.forEach(entity => {
            if (entity instanceof Player) {
                const screenPos = camera.worldToScreen(entity.position.x, entity.position.y)
                entity.render(this.ctx, playerImage, screenPos.x, screenPos.y)
            } else if (entity instanceof Monster) {
                entity.render(this.ctx, camera)
            } else if (entity instanceof ItemDrop) {
                entity.render(this.ctx, camera, this.resourceLoader)
            }
        })
    }

    private renderUI(
        player: Player,
        camera: Camera,
        gameState: string,
        inventoryManager: InventoryManager,
        monsters: Monster[],
        mapRect: { x: number; y: number; w: number; h: number } | null
    ): void {
        if (player.isInventoryOpen) {
            inventoryManager.render(this.ctx, this.resourceLoader)
        }

        // 미니맵 — 맵 이미지 우상단에 고정
        this.miniMap.render(this.ctx, player.position, monsters, mapRect ?? undefined)

        // 하단 HUD — 맵 이미지 하단 기준
        this.interfaceManager.render(this.ctx, player, this.resourceLoader, mapRect ?? undefined)

        // 디버그 정보는 항상 최상단
        this.renderDebugInfo(player, camera, gameState)
    }

    /**
     * 피격 시 화면 가장자리 붉은 비네트 렌더.
     * player.isDamaged 가 true인 동안 호출됩니다.
     *
     * ─ 강도 조정: alpha 값 수정
     * ─ 크기 조정: innerRadius(0.35) 수정
     */
    private renderHitVignette(): void {
        const alpha = 0.45

        const w = this.canvas.width
        const h = this.canvas.height
        const cx = w / 2
        const cy = h / 2
        const r = Math.max(w, h) * 0.75

        const grad = this.ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r)
        grad.addColorStop(0, `rgba(200, 0, 0, 0)`)
        grad.addColorStop(1, `rgba(200, 0, 0, ${alpha})`)

        this.ctx.save()
        this.ctx.fillStyle = grad
        this.ctx.fillRect(0, 0, w, h)
        this.ctx.restore()
    }

    private renderDebugInfo(player: Player, camera: Camera, gameState: string): void {
        this.ctx.save()
        this.ctx.textAlign = 'left'
        this.ctx.textBaseline = 'alphabetic'
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
        this.ctx.fillRect(10, 10, 220, 140)

        this.applyTextShadow(this.ctx)
        this.ctx.fillStyle = '#fff'
        this.ctx.font = '13px monospace'
        this.ctx.fillText(`FPS: ${this.fps}`, 20, 30)
        this.ctx.fillText(`Player: (${Math.floor(player.position.x)}, ${Math.floor(player.position.y)})`, 20, 50)
        this.ctx.fillText(`Camera: (${Math.floor(camera.position.x)}, ${Math.floor(camera.position.y)})`, 20, 70)
        this.ctx.fillText(`C-Scale: ${camera.scale.toFixed(2)}`, 20, 90)
        this.ctx.fillText(`State: ${gameState}`, 20, 110)
        this.ctx.fillText(`Moving: ${player.isMoving ? 'Yes' : 'No'}`, 20, 130)
        this.ctx.restore()
    }

    private applyTextShadow(ctx: CanvasRenderingContext2D): void {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
    }
}
