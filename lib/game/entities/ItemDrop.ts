import { Vector2 } from '../utils/math'
import { ItemData } from '../config/types'
import { currentLang } from '../config/Locale'

/**
 * 필드에 드랍된 아이템 엔티티
 */
export class ItemDrop {
    public id: string
    public position: Vector2
    public data: ItemData
    public dropHeight: number = 30
    public isCollected: boolean = false

    // 단순 부유 효과를 위한 타이머
    private floatTimer: number = 0

    constructor(x: number, y: number, data: ItemData) {
        this.position = new Vector2(x, y)
        this.data = data
        this.id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        // 랜덤 시작 위상
        this.floatTimer = Math.random() * Math.PI * 2
    }

    update(deltaTime: number): void {
        this.floatTimer += deltaTime * 2
    }

    render(ctx: CanvasRenderingContext2D, camera: any): void {
        if (this.isCollected) return

        const screenPos = camera.worldToScreen(this.position.x, this.position.y)
        const screenX = screenPos.x
        const screenY = screenPos.y

        if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
            screenY < -50 || screenY > ctx.canvas.height + 50) return

        ctx.save()

        const floatY = Math.sin(this.floatTimer) * 5
        ctx.translate(screenX, screenY + floatY)

        // 아이템 등급별 색상
        let color = '#ffffff' // Common
        switch (this.data.rarity) {
            case 'Uncommon': color = '#1eff00'; break;
            case 'Rare': color = '#0070dd'; break;
            case 'Epic': color = '#a335ee'; break;
            case 'Legendary': color = '#ff8000'; break;
        }

        let dropWidth = (this.data.nameLocale?.[currentLang] ?? this.data.name).length * 15

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(-dropWidth / 2, -this.dropHeight / 2, dropWidth, this.dropHeight)

        ctx.font = 'bold 14px sans-serif'
        ctx.fillStyle = color
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(this.data.nameLocale?.[currentLang] ?? this.data.name, 0, 0)

        // 테두리 (등급 색상)
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.strokeRect(-dropWidth / 2, -this.dropHeight / 2, dropWidth, this.dropHeight)

        ctx.restore()
    }
}
