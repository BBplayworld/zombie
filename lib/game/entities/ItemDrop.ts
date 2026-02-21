import { Vector2 } from '../utils/math'
import { ItemData } from '../config/types'

/**
 * 필드에 드랍된 아이템 엔티티
 */
export class ItemDrop {
    public id: string
    public position: Vector2
    public data: ItemData
    public width: number = 64
    public height: number = 64
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

    render(ctx: CanvasRenderingContext2D, camera: any, resourceLoader?: any): void {
        if (this.isCollected) return

        // 화면 좌표: camera.worldToScreen 사용 (scale 반영)
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

        let itemImage = null
        if (resourceLoader) {
            itemImage = resourceLoader.getImage(this.data.type.toLowerCase())
            // Fallback to helmet if not found (optional, or better keep null)
            if (!itemImage) itemImage = resourceLoader.getImage('helmet')
        }

        let drawn = false
        if (itemImage && itemImage.complete && itemImage.naturalWidth > 0) {
            // Check for 4x3 sprite sheet (1.33 ratio)
            const aspect = itemImage.naturalWidth / itemImage.naturalHeight
            // Allow some tolerance for 4:3 (1.333...)
            const key = this.data.type?.toLowerCase() || ''
            const isSpriteSheet = (aspect >= 1.25 && aspect <= 1.45) ||
                ['helmet', 'armor', 'weapon', 'shield'].includes(key)

            // Draw shadow/glow behind item
            ctx.shadowColor = color
            ctx.shadowBlur = 15

            if (isSpriteSheet) {
                // 4x3 Grid -> Frame Width = W/4, Frame Height = H/3
                // Use natural dimensions
                const fw = itemImage.naturalWidth / 4
                const fh = itemImage.naturalHeight / 3

                // Draw only the first frame (0,0)
                ctx.drawImage(
                    itemImage,
                    0, 0, fw, fh,
                    -this.width / 2, -this.height / 2, this.width, this.height
                )
            } else {
                ctx.drawImage(
                    itemImage,
                    -this.width / 2, -this.height / 2, this.width, this.height
                )
            }
            drawn = true
            ctx.shadowBlur = 0
        }

        if (!drawn) {
            // Fallback text rendering
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height)

            ctx.font = 'bold 24px sans-serif'
            ctx.fillStyle = color
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            // Show first letter of Type
            ctx.fillText(this.data.type.substring(0, 1), 0, 0)
        }

        // 테두리 (등급 색상)
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height)

        ctx.restore()
    }
}
