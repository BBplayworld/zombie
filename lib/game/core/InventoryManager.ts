import { Player } from '../entities/Player'
import { ItemType } from '../config/types'
import { inventoryConfig } from '../config/Inventory'
import { InputManager } from '../systems/InputManager'
import { t } from '../config/Locale'
import { ResourceLoader } from '../systems/ResourceLoader'
import { Item } from '../entities/Item'

/**
 * 인벤토리 상호작용 및 렌더링 관리자
 */
export class InventoryManager {
    private player: Player
    private canvas: HTMLCanvasElement

    constructor(player: Player, canvas: HTMLCanvasElement) {
        this.player = player
        this.canvas = canvas
    }

    /**
     * 메인 렌더링 함수
     */
    render(ctx: CanvasRenderingContext2D, resourceLoader: ResourceLoader): void {
        const cfg = inventoryConfig
        const winPos = this.getWindowPosition(cfg)

        this.renderOverlay(ctx)
        this.renderWindow(ctx, resourceLoader, winPos, cfg)
        this.renderTitle(ctx, winPos, cfg)
        this.renderStats(ctx, winPos, cfg)
        this.renderEquipment(ctx, resourceLoader, winPos, cfg)
        this.renderInventoryGrid(ctx, resourceLoader, winPos, cfg)
        this.renderCloseButton(ctx, winPos, cfg)

        if (this.player.inventoryMenu) {
            this.renderContextMenu(ctx, this.player.inventoryMenu)
        }

        if (this.player.hoveredItem) {
            const { item, x, y } = this.player.hoveredItem
            this.renderTooltip(ctx, item, x, y, cfg, resourceLoader)
        }
    }

    /**
     * 배경 어둡게 처리
     */
    private renderOverlay(ctx: CanvasRenderingContext2D): void {
        ctx.save()
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
        ctx.restore()
    }

    /**
     * 인벤토리 윈도우 배경 렌더링
     */
    private renderWindow(ctx: CanvasRenderingContext2D, resourceLoader: ResourceLoader, winPos: { x: number, y: number }, cfg: any): void {
        const windowImg = resourceLoader.getImage('window')
        const { width: winW, height: winH } = cfg.window

        ctx.save()
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
        ctx.shadowBlur = 10
        ctx.shadowOffsetX = 5
        ctx.shadowOffsetY = 5

        if (windowImg) {
            ctx.drawImage(windowImg, winPos.x, winPos.y, winW, winH)
        } else {
            ctx.fillStyle = 'rgba(20, 20, 30, 0.95)'
            ctx.fillRect(winPos.x, winPos.y, winW, winH)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
            ctx.lineWidth = 2
            ctx.strokeRect(winPos.x, winPos.y, winW, winH)
        }
        ctx.restore()
    }

    /**
     * 제목 렌더링
     */
    private renderTitle(ctx: CanvasRenderingContext2D, winPos: { x: number, y: number }, cfg: any): void {
        ctx.save()
        ctx.fillStyle = '#e0c0a0'
        ctx.font = 'bold 26px serif'
        ctx.textAlign = 'center'
        this.applyTextShadow(ctx)
        ctx.fillText(t('inventory.title'), winPos.x + cfg.window.width / 2, winPos.y + 45)
        ctx.restore()
    }

    /**
     * 플레이어 스탯 정보 렌더링
     */
    private renderStats(ctx: CanvasRenderingContext2D, winPos: { x: number, y: number }, cfg: any): void {
        const statX = winPos.x + cfg.statsArea.x
        let statY = winPos.y + cfg.statsArea.y
        const lineHeight = cfg.statsArea.lineHeight

        ctx.save()
        // Attributes Title
        ctx.font = `bold ${cfg.statsArea.titleFontSize}px ${cfg.textStyles.fontFamily}`
        ctx.fillStyle = cfg.textStyles.title
        this.applyTextShadow(ctx)
        ctx.fillText(t('inventory.attributes'), statX, statY)
        statY += lineHeight + 10

        // Core Stats
        ctx.font = `${cfg.statsArea.fontSize}px monospace`
        const stats: string[] = ['Vigor', 'Spirit', 'Might', 'Agility', 'Perception']
        stats.forEach(key => {
            const val = (this.player.stats as any)[key]
            ctx.fillStyle = cfg.textStyles.label
            ctx.fillText(`${t(`inventory.stats.${key}`)}:`, statX, statY)

            ctx.font = `bold ${cfg.statsArea.fontSize}px monospace`
            ctx.fillStyle = cfg.textStyles.value
            ctx.fillText(` ${val}`, statX + 110, statY)

            ctx.font = `${cfg.statsArea.fontSize}px monospace` // Reset font for next key
            statY += lineHeight
        })

        statY += 25

        // Combat Stats Title
        ctx.font = `bold ${cfg.statsArea.titleFontSize}px ${cfg.textStyles.fontFamily}`
        ctx.fillStyle = cfg.textStyles.title
        ctx.fillText(t('inventory.combatStats'), statX, statY)
        statY += lineHeight + 10

        // Combat Stats Values
        const drawCombatStat = (labelKey: string, val: string) => {
            ctx.font = `${cfg.statsArea.fontSize}px monospace`
            ctx.fillStyle = cfg.textStyles.label
            ctx.fillText(`${t(`inventory.stats.${labelKey}`)}:`, statX, statY)

            ctx.font = `bold ${cfg.statsArea.fontSize}px monospace`
            ctx.fillStyle = '#ff8c00' // Highlight secondary color
            ctx.fillText(` ${val}`, statX + 110, statY)
            statY += lineHeight
        }

        drawCombatStat('HP', `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`)
        drawCombatStat('Damage', `${this.player.damage}`)
        drawCombatStat('Speed', `${this.player.speed.toFixed(1)}`)
        drawCombatStat('Crit', `${(this.player.critChance * 100).toFixed(0)}%`)
        ctx.restore()
    }

    /**
     * 장착 슬롯 렌더링
     */
    private renderEquipment(ctx: CanvasRenderingContext2D, resourceLoader: ResourceLoader, winPos: { x: number, y: number }, cfg: any): void {
        Object.entries(cfg.equipmentSlots).forEach(([slotName, rect]: [string, any]) => {
            const item = this.player.equipment[slotName as ItemType]
            const slotX = winPos.x + rect.x
            const slotY = winPos.y + rect.y

            // 슬롯 배경/테두리
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
            ctx.fillRect(slotX, slotY, rect.width, rect.height)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
            ctx.strokeRect(slotX, slotY, rect.width, rect.height)

            if (item) {
                this.renderItemIcon(ctx, resourceLoader, item, slotX, slotY, rect.width, rect.height)
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
                ctx.font = '10px sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText(slotName.toUpperCase(), slotX + rect.width / 2, slotY + rect.height / 2 + 5)
            }
        })
    }

    /**
     * 인벤토리 아이템 그리드 렌더링
     */
    private renderInventoryGrid(ctx: CanvasRenderingContext2D, resourceLoader: ResourceLoader, winPos: { x: number, y: number }, cfg: any): void {
        const { x, y, slotSize, gap, cols } = cfg.itemArea
        const startX = winPos.x + x
        const startY = winPos.y + y

        this.player.inventory.items.forEach((item, index) => {
            const col = index % cols
            const row = Math.floor(index / cols)
            const itemX = startX + col * (slotSize + gap)
            const itemY = startY + row * (slotSize + gap)

            // 슬롯 배경
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
            ctx.fillRect(itemX, itemY, slotSize, slotSize)

            // 희귀도 테두리
            ctx.strokeStyle = this.getRarityColor(item.data.rarity)
            ctx.lineWidth = 2
            ctx.strokeRect(itemX, itemY, slotSize, slotSize)
            ctx.lineWidth = 1

            this.renderItemIcon(ctx, resourceLoader, item, itemX, itemY, slotSize, slotSize, 3)
        })
    }

    /**
     * 공통 아이템 아이콘 표현 로직
     */
    private renderItemIcon(
        ctx: CanvasRenderingContext2D,
        resourceLoader: ResourceLoader,
        item: Item,
        x: number,
        y: number,
        w: number,
        h: number,
        padding: number = 2
    ): void {
        const key = item.getImageKey()
        const img = resourceLoader.getImage(key)

        if (img && img.complete) {
            const aspect = img.naturalWidth / img.naturalHeight
            const isSprite = aspect > 1.3 && aspect < 1.4 // 4:3 비율 체크

            if (isSprite || ['helmet', 'armor', 'weapon', 'shield'].includes(key)) {
                const fw = img.naturalWidth / 4
                const fh = img.naturalHeight / 3
                ctx.drawImage(img, 0, 0, fw, fh, x + padding, y + padding, w - padding * 2, h - padding * 2)
            } else {
                ctx.drawImage(img, x + padding, y + padding, w - padding * 2, h - padding * 2)
            }
        }
    }

    /**
     * 닫기 버튼 렌더링
     */
    private renderCloseButton(ctx: CanvasRenderingContext2D, winPos: { x: number, y: number }, cfg: any): void {
        const btnSize = cfg.closeButton.width
        const btnMargin = cfg.closeButton.margin
        const closeX = winPos.x + cfg.window.width - btnSize - btnMargin
        const closeY = winPos.y + btnMargin

        ctx.save()
        // Button Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 4

        ctx.fillStyle = 'rgba(180, 40, 40, 0.9)'
        ctx.fillRect(closeX, closeY, btnSize, btnSize)
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.strokeRect(closeX, closeY, btnSize, btnSize)

        ctx.fillStyle = '#fff'
        ctx.font = 'bold 20px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('X', closeX + btnSize / 2, closeY + btnSize / 2)
        ctx.restore()
    }

    /**
     * 컨텍스트 메뉴 렌더링 (장착/취소)
     */
    private renderContextMenu(ctx: CanvasRenderingContext2D, menu: { x: number, y: number, itemIndex: number }): void {
        const { x, y } = menu
        const menuW = 100
        const menuH = 64

        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.8)'
        ctx.shadowBlur = 10

        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(x, y, menuW, menuH)
        ctx.strokeStyle = '#c0a080'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, menuW, menuH)

        ctx.fillStyle = '#fff'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Equip
        ctx.fillText(t('inventory.equip'), x + menuW / 2, y + 16)

        // Separator
        ctx.strokeStyle = '#333'
        ctx.beginPath()
        ctx.moveTo(x + 5, y + 32)
        ctx.lineTo(x + menuW - 5, y + 32)
        ctx.stroke()

        // Cancel
        ctx.fillText(t('inventory.cancel'), x + menuW / 2, y + 48)
        ctx.restore()
    }

    private renderTooltip(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, cfg: any, resourceLoader: ResourceLoader): void {
        const padding = cfg.tooltip.padding
        const width = cfg.tooltip.width
        const stats = item.data.stats || {}

        // Image setup
        const key = item.getImageKey ? item.getImageKey() : item.data.type?.toLowerCase() || 'helmet'
        const img = resourceLoader.getImage(key)
        const imgSize = 140
        const hasImage = !!img && img.complete && img.naturalWidth > 0

        // Height calculation
        let height = 30 + padding * 2 // Title
        if (hasImage) height += imgSize + 15
        height += 30 // Rarity
        height += Object.keys(stats).length * 30 // Stats
        height += 10 // Bottom margin

        // Positioning
        let tx = Math.min(x + 20, this.canvas.width - width - 10)
        let ty = Math.min(y + 20, this.canvas.height - height - 10)
        if (ty < 10) ty = 10

        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.8)'
        ctx.shadowBlur = 15

        // Background
        ctx.fillStyle = 'rgba(15, 15, 25, 0.95)'
        ctx.fillRect(tx, ty, width, height)
        ctx.strokeStyle = '#c0a080'
        ctx.lineWidth = 2
        ctx.strokeRect(tx, ty, width, height)

        let currentY = ty + padding + 20

        // Title
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 18px serif'
        ctx.textAlign = 'center'
        this.applyTextShadow(ctx)
        ctx.fillText(item.data.name, tx + width / 2, currentY)
        currentY += 15

        // Image
        if (hasImage) {
            const ix = tx + (width - imgSize) / 2
            const iy = currentY + 5
            this.renderItemIcon(ctx, resourceLoader, item, ix, iy, imgSize, imgSize)
            currentY += imgSize + 15
        }

        // Rarity
        ctx.fillStyle = this.getRarityColor(item.data.rarity)
        ctx.font = 'italic 14px serif'
        ctx.fillText(item.data.rarity, tx + width / 2, currentY)
        currentY += 25

        // Stats
        ctx.textAlign = 'left'
        ctx.font = '14px monospace'
        Object.entries(stats).forEach(([sKey, sVal]: [string, any]) => {
            let label = `${t(`inventory.stats.${sKey}`)}: `
            ctx.fillStyle = '#aaa'
            ctx.fillText(label, tx + padding, currentY)

            const measure = ctx.measureText(label)
            let valText = ''
            if (sVal.flat) valText += `+${sVal.flat} `

            ctx.fillStyle = '#fff'
            ctx.fillText(valText, tx + padding + measure.width, currentY)

            if (sVal.percent) {
                const valMeasure = ctx.measureText(valText)
                ctx.fillStyle = '#ffd700' // Gold for percent
                ctx.font = 'bold 14px monospace'
                ctx.fillText(`(+${(sVal.percent * 100).toFixed(0)}%)`, tx + padding + measure.width + valMeasure.width, currentY)
                ctx.font = '14px monospace'
            }
            currentY += 28
        })
        ctx.restore()
    }

    /**
     * 텍스트 그림자 공통 적용
     */
    private applyTextShadow(ctx: CanvasRenderingContext2D): void {
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
    }

    private getRarityColor(rarity: string): string {
        switch (rarity) {
            case 'Common': return '#9d9d9d'
            case 'Uncommon': return '#1eff00'
            case 'Rare': return '#0070dd'
            case 'Epic': return '#a335ee'
            case 'Legendary': return '#ff8000'
            default: return '#fff'
        }
    }

    private getWindowPosition(cfg: any): { x: number, y: number } {
        const { width: winW, height: winH } = cfg.window
        const { anchor, x, y } = cfg.position
        const cvsW = this.canvas.width
        const cvsH = this.canvas.height

        if (anchor === 'top-right') return { x: cvsW - winW - x, y }
        if (anchor === 'top-left') return { x, y }
        if (anchor === 'center') return { x: (cvsW - winW) / 2 + x, y: (cvsH - winH) / 2 + y }
        return { x: cvsW - winW - 20, y: 20 }
    }

    handleHover(inputManager: InputManager): void {
        const mousePos = inputManager.getMousePosition()
        const rect = this.canvas.getBoundingClientRect()
        const mouseX = mousePos.x - rect.left
        const mouseY = mousePos.y - rect.top

        const cfg = inventoryConfig
        const winPos = this.getWindowPosition(cfg)
        let hovered = false
        this.player.hoveredItem = null

        // Grid Hover
        const { x, y, slotSize, gap, cols } = cfg.itemArea
        const startX = winPos.x + x
        const startY = winPos.y + y

        this.player.inventory.items.forEach((item, index) => {
            const col = index % cols
            const row = Math.floor(index / cols)
            const itemX = startX + col * (slotSize + gap)
            const itemY = startY + row * (slotSize + gap)

            if (mouseX >= itemX && mouseX <= itemX + slotSize && mouseY >= itemY && mouseY <= itemY + slotSize) {
                this.player.hoveredItem = { item, x: mouseX, y: mouseY }
                hovered = true
            }
        })

        // Equipment Hover
        if (!hovered) {
            Object.entries(cfg.equipmentSlots).forEach(([slotName, r]: [string, any]) => {
                const sx = winPos.x + r.x
                const sy = winPos.y + r.y
                if (mouseX >= sx && mouseX <= sx + r.width && mouseY >= sy && mouseY <= sy + r.height) {
                    const item = this.player.equipment[slotName as ItemType]
                    if (item) {
                        this.player.hoveredItem = { item, x: mouseX, y: mouseY }
                        hovered = true
                    }
                    hovered = true // cursor pointer for slot even if empty?
                }
            })
        }

        // Close Button Hover
        const bSize = cfg.closeButton.width
        const bMargin = cfg.closeButton.margin
        const cx = winPos.x + cfg.window.width - bSize - bMargin
        const cy = winPos.y + bMargin
        if (mouseX >= cx && mouseX <= cx + bSize && mouseY >= cy && mouseY <= cy + bSize) hovered = true

        this.canvas.style.cursor = hovered ? 'pointer' : 'default'

        if (this.player.inventoryMenu) {
            const { x: mx, y: my } = this.player.inventoryMenu
            if (mouseX >= mx && mouseX <= mx + 100 && mouseY >= my && mouseY <= my + 64) {
                this.canvas.style.cursor = 'pointer'
            }
        }
    }

    handleClick(e: MouseEvent): boolean {
        const rect = this.canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        const cfg = inventoryConfig
        const winPos = this.getWindowPosition(cfg)
        const { width: winW, height: winH } = cfg.window

        // Context Menu
        if (this.player.inventoryMenu) {
            const { x: mx, y: my } = this.player.inventoryMenu
            if (mouseX >= mx && mouseX <= mx + 100 && mouseY >= my && mouseY <= my + 64) {
                if (mouseY < my + 32) {
                    const idx = this.player.inventoryMenu.itemIndex
                    const item = this.player.inventory.items[idx]
                    if (item) this.player.equipItem(item)
                }
                this.player.inventoryMenu = null
                return true
            }
            this.player.inventoryMenu = null
            return true
        }

        if (mouseX < winPos.x || mouseX > winPos.x + winW || mouseY < winPos.y || mouseY > winPos.y + winH) return false

        // Close Button
        const bSize = cfg.closeButton.width
        const bMargin = cfg.closeButton.margin
        const cx = winPos.x + winW - bSize - bMargin
        const cy = winPos.y + bMargin
        if (mouseX >= cx && mouseX <= cx + bSize && mouseY >= cy && mouseY <= cy + bSize) {
            this.player.isInventoryOpen = false
            return true
        }

        // Grid Click
        const { x, y, slotSize, gap, cols } = cfg.itemArea
        const startX = winPos.x + x
        const startY = winPos.y + y
        let slotClicked = false
        this.player.inventory.items.forEach((item, index) => {
            const col = index % cols
            const row = Math.floor(index / cols)
            const itemX = startX + col * (slotSize + gap)
            const itemY = startY + row * (slotSize + gap)
            if (mouseX >= itemX && mouseX <= itemX + slotSize && mouseY >= itemY && mouseY <= itemY + slotSize) {
                this.player.inventoryMenu = { x: mouseX, y: mouseY, itemIndex: index }
                slotClicked = true
            }
        })
        if (slotClicked) return true

        // Equipment Click (Unequip)
        let equipClicked = false
        Object.entries(cfg.equipmentSlots).forEach(([slotName, r]: [string, any]) => {
            const sx = winPos.x + r.x
            const sy = winPos.y + r.y
            if (mouseX >= sx && mouseX <= sx + r.width && mouseY >= sy && mouseY <= sy + r.height) {
                if (this.player.equipment[slotName as ItemType]) {
                    this.player.unequipItem(slotName as ItemType)
                    equipClicked = true
                }
            }
        })
        if (equipClicked) return true

        return true
    }
}
