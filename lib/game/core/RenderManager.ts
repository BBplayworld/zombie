import { Camera } from '../systems/Camera'
import { Player } from '../entities/Player'
import { Monster } from '../entities/Monster'
import { TileMap } from '../systems/TileMap'
import { ResourceLoader } from '../systems/ResourceLoader'

/**
 * 렌더링 관리 클래스
 * 게임 화면 렌더링 로직을 담당
 */
export class RenderManager {
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private resourceLoader: ResourceLoader

    // FPS 추적
    private fps: number = 0
    private frameCount: number = 0
    private fpsUpdateTime: number = 0

    constructor(canvas: HTMLCanvasElement, resourceLoader: ResourceLoader) {
        this.canvas = canvas
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get 2D context')
        this.ctx = ctx
        this.resourceLoader = resourceLoader
    }

    /**
     * FPS 계산 업데이트
     */
    updateFPS(currentTime: number): void {
        this.frameCount++
        if (currentTime - this.fpsUpdateTime >= 1000) {
            this.fps = this.frameCount
            this.frameCount = 0
            this.fpsUpdateTime = currentTime
        }
    }

    /**
     * 게임 전체 렌더링
     */
    render(
        tileMap: TileMap,
        camera: Camera,
        player: Player,
        monsters: Monster[],
        gameState: string
    ): void {
        this.clearScreen()
        this.ctx.save()

        // 1. 타일맵 렌더링
        tileMap.render(this.ctx, camera)

        // 2. 엔티티 렌더링 (Y축 정렬)
        this.renderEntities(player, monsters, camera)

        this.ctx.restore()

        // 3. UI 렌더링
        this.renderUI(player, camera, gameState)
    }

    /**
     * 화면 클리어
     */
    private clearScreen(): void {
        this.ctx.fillStyle = '#111'
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }

    /**
     * 엔티티 렌더링 (플레이어 + 몬스터)
     */
    private renderEntities(player: Player, monsters: Monster[], camera: Camera): void {
        // Y축 정렬 (Z-Sorting)
        const entities = [player, ...monsters]
        entities.sort((a, b) => a.position.y - b.position.y)

        const playerImage = this.resourceLoader.getImage('player')
        const monsterImage = this.resourceLoader.getImage('monster')

        entities.forEach(entity => {
            if (entity instanceof Player) {
                const screenPos = camera.worldToScreen(entity.position.x, entity.position.y)
                entity.render(this.ctx, playerImage, screenPos.x, screenPos.y)
            } else if (entity instanceof Monster) {
                if (monsterImage) entity.setSpriteImage(monsterImage)
                entity.render(this.ctx, camera)
            }
        })
    }

    /**
     * UI 렌더링
     */
    private renderUI(player: Player, camera: Camera, gameState: string): void {
        this.renderDebugInfo(player, camera, gameState)
        this.renderControls()
    }

    /**
     * 디버그 정보 렌더링
     */
    private renderDebugInfo(player: Player, camera: Camera, gameState: string): void {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        this.ctx.fillRect(10, 10, 200, 120)

        this.ctx.fillStyle = '#fff'
        this.ctx.font = '14px monospace'
        this.ctx.fillText(`FPS: ${this.fps}`, 20, 30)
        this.ctx.fillText(`Player: (${Math.floor(player.position.x)}, ${Math.floor(player.position.y)})`, 20, 50)
        this.ctx.fillText(`Camera: (${Math.floor(camera.position.x)}, ${Math.floor(camera.position.y)})`, 20, 70)
        this.ctx.fillText(`State: ${gameState}`, 20, 90)
        this.ctx.fillText(`Moving: ${player.isMoving ? 'Yes' : 'No'}`, 20, 110)
    }

    /**
     * 조작법 렌더링
     */
    private renderControls(): void {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        this.ctx.fillRect(10, this.canvas.height - 80, 250, 70)

        this.ctx.fillStyle = '#fff'
        this.ctx.font = 'bold 16px sans-serif'
        this.ctx.fillText('조작법', 20, this.canvas.height - 55)
        this.ctx.font = '14px sans-serif'
        this.ctx.fillText('이동: 방향키 또는 WASD', 20, this.canvas.height - 35)
        this.ctx.fillText('ESC: 일시정지', 20, this.canvas.height - 15)
    }
}
