import { Camera } from '../systems/Camera'
import { Player } from '../entities/Player'
import { Monster } from '../entities/Monster'
import { ItemDrop } from '../entities/ItemDrop'
import { TileMap } from '../systems/TileMap'
import { ResourceLoader } from '../systems/ResourceLoader'
import { InventoryManager } from './InventoryManager'
import { InterfaceManager } from './InterfaceManager'
import { MiniMap } from '../systems/MiniMap'

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

    /** 인벤토리 아이콘 클릭 영역 — InterfaceManager를 직접 참조하거나 이 프록시 사용 */
    get inventoryIconRect() {
        return this.interfaceManager.inventoryIconRect
    }

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
        tileMap: TileMap,
        camera: Camera,
        player: Player,
        monsters: Monster[],
        items: ItemDrop[],
        gameState: string,
        inventoryManager: InventoryManager
    ): void {
        this.clearScreen()
        this.ctx.save()

        // 1. 타일맵
        tileMap.render(this.ctx, camera)

        // 2. 엔티티 (Y축 정렬)
        this.renderEntities(player, monsters, items, camera)

        this.ctx.restore()

        // 3. UI (인벤토리 → 미니맵 → HUD 순)
        this.renderUI(player, camera, gameState, inventoryManager, monsters)
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
        monsters: Monster[]
    ): void {
        if (player.isInventoryOpen) {
            inventoryManager.render(this.ctx, this.resourceLoader)
        }

        // 미니맵 (인벤토리 위에도 표시)
        this.miniMap.render(this.ctx, player.position, monsters)

        // 하단 HUD — InterfaceManager에 위임
        this.interfaceManager.render(this.ctx, player, this.resourceLoader)

        // 디버그 정보는 항상 최상단
        this.renderDebugInfo(player, camera, gameState)
    }

    private renderDebugInfo(player: Player, camera: Camera, gameState: string): void {
        this.ctx.save()
        this.ctx.textAlign = 'left'
        this.ctx.textBaseline = 'alphabetic'
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
        this.ctx.fillRect(10, 10, 220, 120)

        this.applyTextShadow(this.ctx)
        this.ctx.fillStyle = '#fff'
        this.ctx.font = '13px monospace'
        this.ctx.fillText(`FPS: ${this.fps}`, 20, 30)
        this.ctx.fillText(`Player: (${Math.floor(player.position.x)}, ${Math.floor(player.position.y)})`, 20, 50)
        this.ctx.fillText(`Camera: (${Math.floor(camera.position.x)}, ${Math.floor(camera.position.y)})`, 20, 70)
        this.ctx.fillText(`State: ${gameState}`, 20, 90)
        this.ctx.fillText(`Moving: ${player.isMoving ? 'Yes' : 'No'}`, 20, 110)
        this.ctx.restore()
    }

    private applyTextShadow(ctx: CanvasRenderingContext2D): void {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
    }
}
