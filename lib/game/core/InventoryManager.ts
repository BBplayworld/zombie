import { Player } from '../entities/player/Player'
import { ItemType, StatType } from '../config/types'
import { inventoryConfig } from '../config/Inventory'
import { InputManager } from '../systems/InputManager'
import { t, currentLang } from '../config/Locale'
import { ResourceLoader } from '../systems/ResourceLoader'
import { Item } from '../entities/Item'
import { ITEM_SPRITE_GRID } from '../config/player'

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
        const windowImg = resourceLoader.getImage('interface_window')
        const { width: winW, height: winH } = cfg.window

        ctx.save()

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
     * 플레이어 스탯 정보 렌더링 (이름 · 값 · 설명 포함)
     */
    private renderStats(ctx: CanvasRenderingContext2D, winPos: { x: number, y: number }, cfg: any): void {
        const statX = winPos.x + cfg.statsArea.x
        let statY = winPos.y + cfg.statsArea.y
        const lineHeight = cfg.statsArea.lineHeight
        const fontSize = cfg.statsArea.fontSize
        const descSize = fontSize - 2
        const fontFamily = 'monospace'
        const labelColW = 90

        ctx.save()
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        this.applyTextShadow(ctx)

        ctx.font = `bold ${cfg.statsArea.titleFontSize}px ${fontFamily}`
        ctx.fillStyle = cfg.textStyles.title
        ctx.fillText(t('inventory.attributes'), statX, statY)
        statY += lineHeight + 4

        // Ле벨 (Level)
        ctx.font = `${fontSize}px ${fontFamily}`
        ctx.fillStyle = cfg.textStyles.label
        ctx.fillText(`Level:`, statX, statY)

        ctx.font = `bold ${fontSize}px ${fontFamily}`
        ctx.fillStyle = '#ffcc00'
        ctx.fillText(String(this.player.levelSystem.level), statX + labelColW, statY)
        statY += lineHeight - 4

        ctx.font = `italic ${descSize}px ${fontFamily}`
        ctx.fillStyle = cfg.textStyles.desc
        ctx.fillText(`EXP: ${Math.floor(this.player.levelSystem.currentExp)} / ${this.player.levelSystem.requiredExp}`, statX, statY)
        statY += descSize + 20

        const coreStats: string[] = ['Vigor', 'Spirit', 'Might', 'Agility', 'Luck']
        coreStats.forEach(key => {
            const val = (this.player.stats as any)[key]

            ctx.font = `${fontSize}px ${fontFamily}`
            ctx.fillStyle = cfg.textStyles.label
            ctx.fillText(`${t(`inventory.stats.${key}`)}:`, statX, statY)

            ctx.font = `bold ${fontSize}px ${fontFamily}`
            ctx.fillStyle = cfg.textStyles.value
            ctx.fillText(String(val), statX + labelColW, statY)

            statY += lineHeight - 4

            ctx.font = `italic ${descSize}px ${fontFamily}`
            ctx.fillStyle = cfg.textStyles.desc
            ctx.fillText(t(`inventory.statDesc.${key}`), statX, statY)
            statY += descSize + 20
        })

        statY += 10

        ctx.font = `bold ${cfg.statsArea.titleFontSize}px ${fontFamily}`
        ctx.fillStyle = cfg.textStyles.title
        ctx.fillText(t('inventory.combatStats'), statX, statY)
        statY += lineHeight + 4

        const combatRows: { key: string, val: string }[] = [
            { key: 'HP', val: `${Math.ceil(this.player.hp)} / ${this.player.maxHp}` },
            { key: 'Damage', val: String(this.player.damage) },
            { key: 'Speed', val: this.player.speed.toFixed(1) },
            { key: 'Crit', val: `${(this.player.critChance * 100).toFixed(0)}%` }
        ]

        combatRows.forEach(({ key, val }) => {
            ctx.font = `${fontSize}px ${fontFamily}`
            ctx.fillStyle = cfg.textStyles.label
            ctx.fillText(`${t(`inventory.stats.${key}`)}:`, statX, statY)

            ctx.font = `bold ${fontSize}px ${fontFamily}`
            ctx.fillStyle = '#ff8c00'
            ctx.fillText(val, statX + labelColW, statY)

            statY += lineHeight - 4

            ctx.font = `italic ${descSize}px ${fontFamily}`
            ctx.fillStyle = cfg.textStyles.desc
            ctx.fillText(t(`inventory.statDesc.${key}`), statX, statY)
            statY += descSize + 20
        })

        ctx.restore()
    }

    /**
     * 장착 슬롯 렌더링
     */
    private renderEquipment(ctx: CanvasRenderingContext2D, resourceLoader: ResourceLoader, winPos: { x: number, y: number }, cfg: any): void {
        ctx.save()
        Object.entries(cfg.equipmentSlots).forEach(([slotName, rect]: [string, any]) => {
            const item = this.player.equipment[slotName as ItemType]
            const slotX = winPos.x + rect.x
            const slotY = winPos.y + rect.y

            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
            ctx.fillRect(slotX, slotY, rect.width, rect.height)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
            ctx.lineWidth = 1
            ctx.strokeRect(slotX, slotY, rect.width, rect.height)

            if (item) {
                this.renderItemIcon(ctx, resourceLoader, item, slotX, slotY, rect.width, rect.height)
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
                ctx.font = '10px monospace'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                const label = t(`inventory.itemTypes.${slotName}`) !== `inventory.itemTypes.${slotName}`
                    ? t(`inventory.itemTypes.${slotName}`)
                    : slotName
                ctx.fillText(label, slotX + rect.width / 2, slotY + rect.height / 2)
            }
        })
        ctx.restore()
    }

    /**
     * 인벤토리 아이템 그리드 렌더링 - 등급별 고급 시각 효과 포함
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

            this.renderItemSlot(ctx, resourceLoader, item, itemX, itemY, slotSize)
        })
    }

    /** 아이템 슬롯 1개 렌더 (등급별 효과 포함) */
    private renderItemSlot(
        ctx: CanvasRenderingContext2D,
        resourceLoader: ResourceLoader,
        item: Item,
        x: number, y: number, size: number
    ): void {
        const rarity = item.data.rarity
        const color = this.getRarityColor(rarity)
        const t = Date.now() / 1000

        ctx.save()

        // ── 배경 ──
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fillRect(x, y, size, size)

        // ── 등급별 배경 그라데이션 ──
        if (rarity !== 'Common') {
            const bgGrad = ctx.createLinearGradient(x, y, x + size, y + size)
            const alpha = rarity === 'Legendary' ? 0.22 : rarity === 'Epic' ? 0.15 : 0.09
            bgGrad.addColorStop(0, color + Math.round(alpha * 255).toString(16).padStart(2, '0'))
            bgGrad.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = bgGrad
            ctx.fillRect(x, y, size, size)
        }

        // ── 아이콘 ──
        this.renderItemIcon(ctx, resourceLoader, item, x, y, size, size)

        // ── 등급별 테두리 ──
        ctx.lineWidth = rarity === 'Legendary' ? 2.5 : rarity === 'Epic' ? 2 : 1.5

        if (rarity === 'Legendary') {
            // Legendary: 회전하는 그라데이션 테두리
            const pulse = 0.6 + 0.4 * Math.sin(t * 3)
            ctx.strokeStyle = `rgba(255, 128, 0, ${pulse})`
            ctx.shadowColor = '#ff8000'
            ctx.shadowBlur = 12 * pulse
        } else if (rarity === 'Epic') {
            const pulse = 0.7 + 0.3 * Math.sin(t * 2.5)
            ctx.strokeStyle = `rgba(163, 53, 238, ${pulse})`
            ctx.shadowColor = '#a335ee'
            ctx.shadowBlur = 8 * pulse
        } else {
            ctx.strokeStyle = color
            ctx.shadowBlur = 0
        }
        ctx.strokeRect(x, y, size, size)
        ctx.shadowBlur = 0

        // ── Legendary 코너 별 장식 ──
        if (rarity === 'Legendary') {
            const starAlpha = 0.5 + 0.5 * Math.sin(t * 4)
            ctx.fillStyle = `rgba(255, 210, 80, ${starAlpha})`
            ctx.font = `bold 8px sans-serif`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'top'
            ctx.fillText('✦', x + 2, y + 2)
        }

        // ── 희귀도 하단 컬러 라인 ──
        if (rarity !== 'Common') {
            ctx.fillStyle = color
            ctx.globalAlpha = 0.8
            ctx.fillRect(x, y + size - 3, size, 3)
            ctx.globalAlpha = 1
        }

        ctx.restore()
    }

    /**
     * 공통 아이템 아이콘 표현 로직 - ITEM_SPRITE_GRID 기반 그리드 슬라이싱
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
        const key = item.getImageKey ? item.getImageKey() : 'item_helmet'
        const img = resourceLoader.getImage(key)
        if (!img || !img.complete || !img.naturalWidth) return

        const grid = ITEM_SPRITE_GRID[key]
        if (grid && (grid.cols > 1 || grid.rows > 1)) {
            // 전체 이미지에서 상하좌우 여백(inset)을 제외한 실제 스프라이트 영역의 크기를 구합니다.
            const ix = grid.insetX || 0
            const iy = grid.insetY || 0
            const actualGridW = img.naturalWidth - ix * 2
            const actualGridH = img.naturalHeight - iy * 2

            // 실제 스프라이트 영역을 기준으로 하나의 프레임 너비와 높이를 구합니다.
            const fw = actualGridW / grid.cols
            const fh = actualGridH / grid.rows

            // 현재 그려야 할 프레임의 행(row)과 열(col)을 계산합니다.
            const col = grid.frameIndex % grid.cols
            const row = Math.floor(grid.frameIndex / grid.cols)

            // ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
            ctx.drawImage(img,
                /* 1. Source (원본 자르기 부분) */
                ix + col * fw,     // sx: 잘라내기 시작 X좌표 (전체 여백 ix 만큼 밀어준 후 열의 위치 이동)
                iy + row * fh,     // sy: 잘라내기 시작 Y좌표 (전체 여백 iy 만큼 밀어준 후 행의 위치 이동)
                fw,                // sWidth: 잘라낼 이미지의 원본 너비 (위에서 계산한 진짜 프레임 너비)
                fh,                // sHeight: 잘라낼 이미지의 원본 높이 (위에서 계산한 진짜 프레임 높이)

                /* 2. Destination (화면 렌더링 부분) */
                x + padding,       // dx: 화면에 그리기 시작할 X좌표 (인벤토리 슬롯 X + 안쪽 여백)
                y + padding,       // dy: 화면에 그리기 시작할 Y좌표 (인벤토리 슬롯 Y + 안쪽 여백)
                w - padding * 2,   // dWidth: 화면에 그릴 최종 너비 (슬롯 크기 - 여백)
                h - padding * 2    // dHeight: 화면에 그릴 최종 높이 (슬롯 크기 - 여백)
            )
        } else {
            // 단일 이미지 전체
            ctx.drawImage(img, x + padding, y + padding, w - padding * 2, h - padding * 2)
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
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 4

        ctx.fillStyle = 'rgba(88, 88, 88, 0.9)'
        ctx.fillRect(closeX, closeY, btnSize, btnSize)
        ctx.strokeStyle = '#969696ff'
        ctx.lineWidth = 0
        ctx.strokeRect(closeX, closeY, btnSize, btnSize)

        ctx.fillStyle = '#fff'
        ctx.font = 'bold 15px sans-serif'
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

        ctx.fillText(t('inventory.equip'), x + menuW / 2, y + 16)

        ctx.strokeStyle = '#333'
        ctx.beginPath()
        ctx.moveTo(x + 5, y + 32)
        ctx.lineTo(x + menuW - 5, y + 32)
        ctx.stroke()

        ctx.fillText(t('inventory.cancel'), x + menuW / 2, y + 48)
        ctx.restore()
    }

    // =========================================================================
    // [개선] 툴팁 & 아이템 비교
    // =========================================================================

    /**
     * 아이템 툴팁 - 마우스오버 시 표시
     * - 호버 아이템 단독 표시
     * - 장착 중인 동일 타입 아이템이 있으면 좌측에 비교 패널 추가
     * - 수치 차이를 색상 + 그라데이션 배지 + 화살표로 강조
     */
    private renderTooltip(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, cfg: any, resourceLoader: ResourceLoader): void {
        const equipped = item.isEquipment && item.isEquipment()
            ? this.player.equipment[item.data.type as ItemType]
            : null
        const isComparison = !!equipped && equipped.data.id !== item.data.id

        if (isComparison && equipped) {
            // 비교 모드: 왼쪽 = 장착 중, 오른쪽 = 호버
            this.renderDualTooltip(ctx, item, equipped, x, y, cfg, resourceLoader)
        } else {
            // 단독 모드
            this.renderSingleTooltip(ctx, item, x, y, cfg, resourceLoader, null)
        }
    }

    // ─────────────────────────────────────────────────────
    //  단독 툴팁
    // ─────────────────────────────────────────────────────
    private renderSingleTooltip(
        ctx: CanvasRenderingContext2D,
        item: any,
        x: number,
        y: number,
        cfg: any,
        resourceLoader: ResourceLoader,
        comparedItem: any | null
    ): void {
        const padding = cfg.tooltip.padding
        const width = cfg.tooltip.width
        const stats = item.data.stats || {}
        const compareStats = comparedItem?.data?.stats

        const key = item.getImageKey ? item.getImageKey() : 'item_' + (item.data.type?.toLowerCase() || 'helmet')
        const img = resourceLoader.getImage(key)
        const imgSize = 120
        const hasImage = !!img && img.complete && img.naturalWidth > 0

        const allStatKeys = Array.from(new Set([
            ...Object.keys(stats),
            ...(compareStats ? Object.keys(compareStats) : [])
        ]))

        let height = 30 + padding * 2      // 타이틀
        if (hasImage) height += imgSize + 10
        height += 28                        // 등급 뱃지
        height += allStatKeys.length * 34   // 스탯 행
        if (comparedItem) height += 10      // 추가 여백
        height += 12                        // 하단 패딩

        // 위치 조정
        let tx = Math.min(x + 20, this.canvas.width - width - 10)
        let ty = Math.max(10, Math.min(y + 20, this.canvas.height - height - 10))

        ctx.save()

        // 배경 (유리 효과)
        this.drawTooltipBackground(ctx, tx, ty, width, height, this.getRarityColor(item.data.rarity))

        let cy = ty + padding + 18

        // 타이틀
        const localizedName = item.data.nameLocale?.[currentLang] ?? item.data.name
        ctx.font = 'bold 17px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = this.getRarityColor(item.data.rarity)
        ctx.shadowColor = this.getRarityColor(item.data.rarity)
        ctx.shadowBlur = 8
        ctx.fillText(localizedName, tx + width / 2, cy)
        cy += 22
        ctx.shadowBlur = 0

        // 아이템 이미지
        if (hasImage) {
            this.renderItemIcon(ctx, resourceLoader, item, tx + (width - imgSize) / 2, cy, imgSize, imgSize)
            cy += imgSize + 8
        }

        // 등급 배지
        cy = this.drawRarityBadge(ctx, tx, cy, width, item.data.rarity)
        cy += 10

        // 스탯 행
        ctx.textAlign = 'left'
        allStatKeys.forEach(sKey => {
            const hStat = (stats as any)[sKey] || { flat: 0, percent: 0 }
            const eqStat = compareStats ? (compareStats as any)[sKey] : null
            cy = this.drawStatRow(ctx, tx, cy, width, padding, sKey, hStat, eqStat, !!comparedItem)
        })

        ctx.restore()
    }

    // ─────────────────────────────────────────────────────
    //  이중 툴팁 (호버 아이템 | 장착 아이템 비교)
    // ─────────────────────────────────────────────────────
    private renderDualTooltip(
        ctx: CanvasRenderingContext2D,
        hoveredItem: any,
        equippedItem: any,
        mx: number,
        my: number,
        cfg: any,
        resourceLoader: ResourceLoader
    ): void {
        const padding = cfg.tooltip.padding
        const panelW = cfg.tooltip.width            // 각 패널 너비
        const gap = 10                              // 두 패널 사이 간격
        const totalW = panelW * 2 + gap

        const hovStats = hoveredItem.data.stats || {}
        const eqStats = equippedItem.data.stats || {}
        const allStatKeys = Array.from(new Set([...Object.keys(hovStats), ...Object.keys(eqStats)])) as string[]

        const imgSize = 100
        let height = 30 + padding * 2
        height += imgSize + 10
        height += 28    // 등급 배지
        height += allStatKeys.length * 34
        height += 16

        // 화면 범위 내 배치
        let tx = mx + 20
        if (tx + totalW > this.canvas.width - 10) tx = mx - totalW - 10
        if (tx < 10) tx = 10
        let ty = Math.max(10, Math.min(my + 20, this.canvas.height - height - 10))

        const leftX = tx
        const rightX = tx + panelW + gap

        ctx.save()

        // ── 장착 중 패널 (왼쪽, 어두운 배경) ──
        this.drawTooltipBackground(ctx, leftX, ty, panelW, height, this.getRarityColor(equippedItem.data.rarity), true)
        this.drawPanelLabel(ctx, leftX, ty, panelW, '장착 중', '#aaa')
        this.fillPanelContent(ctx, resourceLoader, equippedItem, hovStats, allStatKeys, leftX, ty, panelW, padding, imgSize, false, cfg)

        // ── 호버(새) 아이템 패널 (오른쪽, 밝은 배경) ──
        this.drawTooltipBackground(ctx, rightX, ty, panelW, height, this.getRarityColor(hoveredItem.data.rarity), false)
        this.drawPanelLabel(ctx, rightX, ty, panelW, '비교 아이템', '#ffd700')
        this.fillPanelContent(ctx, resourceLoader, hoveredItem, eqStats, allStatKeys, rightX, ty, panelW, padding, imgSize, true, cfg)

        // ── 중앙 구분선 ──
        ctx.save()
        const lineGrad = ctx.createLinearGradient(tx + panelW, ty, tx + panelW + gap, ty + height)
        lineGrad.addColorStop(0, 'rgba(255,215,0,0.0)')
        lineGrad.addColorStop(0.5, 'rgba(255,215,0,0.6)')
        lineGrad.addColorStop(1, 'rgba(255,215,0,0.0)')
        ctx.fillStyle = lineGrad
        ctx.fillRect(tx + panelW + 3, ty, gap - 6, height)
        ctx.restore()

        ctx.restore()
    }

    // ─────────────────────────────────────────────────────
    //  패널 공통 내용 그리기
    // ─────────────────────────────────────────────────────
    private fillPanelContent(
        ctx: CanvasRenderingContext2D,
        resourceLoader: ResourceLoader,
        item: any,
        compareStats: any,
        allStatKeys: string[],
        panelX: number,
        panelY: number,
        panelW: number,
        padding: number,
        imgSize: number,
        isHovered: boolean,
        cfg: any
    ): void {
        const stats = item.data.stats || {}
        let cy = panelY + padding + 28  // 28 = 라벨 높이 여유

        // 아이템 이름
        const localizedName = item.data.nameLocale?.[currentLang] ?? item.data.name
        ctx.font = `bold 15px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = this.getRarityColor(item.data.rarity)
        ctx.shadowColor = this.getRarityColor(item.data.rarity)
        ctx.shadowBlur = 6
        ctx.fillText(localizedName, panelX + panelW / 2, cy)
        cy += 20
        ctx.shadowBlur = 0

        // 아이템 이미지
        const imgX = panelX + (panelW - imgSize) / 2
        this.renderItemIcon(ctx, resourceLoader, item, imgX, cy, imgSize, imgSize)
        cy += imgSize + 8

        // 등급 배지
        cy = this.drawRarityBadge(ctx, panelX, cy, panelW, item.data.rarity)
        cy += 10

        // 스탯 비교 행
        ctx.textAlign = 'left'
        allStatKeys.forEach(sKey => {
            const hStat = (stats as any)[sKey] || { flat: 0, percent: 0 }
            const eqStat = compareStats ? ((compareStats as any)[sKey] || { flat: 0, percent: 0 }) : null
            cy = this.drawStatRow(ctx, panelX, cy, panelW, padding, sKey, hStat, eqStat, isHovered)
        })
    }

    // ─────────────────────────────────────────────────────
    //  패널 상단 레이블 ('장착 중' / '비교 아이템')
    // ─────────────────────────────────────────────────────
    private drawPanelLabel(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, text: string, color: string): void {
        ctx.save()
        ctx.font = 'bold 11px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(px, py, pw, 20)
        ctx.fillStyle = color
        ctx.fillText(text, px + pw / 2, py + 10)
        ctx.restore()
    }

    // ─────────────────────────────────────────────────────
    //  툴팁 배경 (유리모피즘)
    // ─────────────────────────────────────────────────────
    private drawTooltipBackground(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number,
        accentColor: string,
        dimmed: boolean = false
    ): void {
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.9)'
        ctx.shadowBlur = 20

        // 메인 배경
        const bgAlpha = dimmed ? 0.82 : 0.92
        ctx.fillStyle = `rgba(12, 14, 22, ${bgAlpha})`
        ctx.fillRect(x, y, w, h)

        // 상단 강조 그라데이션 (등급 색상)
        const topGrad = ctx.createLinearGradient(x, y, x, y + 40)
        topGrad.addColorStop(0, accentColor + '30')
        topGrad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = topGrad
        ctx.fillRect(x, y, w, 40)

        // 테두리
        ctx.shadowBlur = 0
        ctx.strokeStyle = dimmed ? 'rgba(120,120,120,0.4)' : accentColor + '90'
        ctx.lineWidth = dimmed ? 1 : 1.5
        ctx.strokeRect(x, y, w, h)

        // 상단 강조 라인
        if (!dimmed) {
            ctx.strokeStyle = accentColor
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(x + 6, y)
            ctx.lineTo(x + w - 6, y)
            ctx.stroke()
        }
        ctx.restore()
    }

    // ─────────────────────────────────────────────────────
    //  등급 배지
    // ─────────────────────────────────────────────────────
    private drawRarityBadge(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number,
        rarity: string
    ): number {
        const color = this.getRarityColor(rarity)
        const localizedRarity = t(`inventory.rarities.${rarity}`)
        const bh = 22
        const bw = 90
        const bx = x + (w - bw) / 2

        // 배지 배경
        const bGrad = ctx.createLinearGradient(bx, y, bx + bw, y)
        bGrad.addColorStop(0, 'rgba(0,0,0,0)')
        bGrad.addColorStop(0.2, color + '40')
        bGrad.addColorStop(0.8, color + '40')
        bGrad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = bGrad
        ctx.fillRect(bx, y, bw, bh)

        ctx.strokeStyle = color + '80'
        ctx.lineWidth = 1
        ctx.strokeRect(bx, y, bw, bh)

        ctx.font = `bold italic 12px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 6
        ctx.fillText(localizedRarity, x + w / 2, y + bh / 2)
        ctx.shadowBlur = 0

        return y + bh
    }

    // ─────────────────────────────────────────────────────
    //  스탯 행 + 비교 수치 강조
    // ─────────────────────────────────────────────────────
    /**
     * 한 스탯 행을 그린다. 비교 수치가 있으면 차이를 강조 표시.
     * @param isHovered true면 "이 아이템"이 기준 (호버), false면 장착 아이템이 기준
     * @returns 다음 행의 y 좌표
     */
    private drawStatRow(
        ctx: CanvasRenderingContext2D,
        panelX: number, y: number, panelW: number,
        padding: number,
        statKey: string,
        thisStat: { flat: number; percent: number },
        otherStat: { flat: number; percent: number } | null,
        isHovered: boolean
    ): number {
        const rowH = 34
        const halfRowH = rowH / 2
        const left = panelX + padding
        const right = panelX + panelW - padding
        const mid = y + halfRowH

        // 행 배경 (짝수 / 홀수 구분 없이 미세 줄무늬)
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fillRect(panelX + 4, y, panelW - 8, rowH - 2)

        // 스탯 이름
        ctx.font = '12px monospace'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(180,180,200,0.9)'
        ctx.fillText(t(`inventory.stats.${statKey}`), left, mid)

        // 스탯 값 (Flat + Percent)
        let valStr = ''
        if (thisStat.flat) valStr += `+${thisStat.flat}`
        if (thisStat.percent) valStr += (valStr ? ' ' : '') + `(${(thisStat.percent * 100).toFixed(0)}%)`
        if (!valStr) valStr = '0'

        ctx.font = 'bold 13px monospace'
        ctx.textAlign = 'right'
        ctx.fillStyle = '#e8e8e8'

        if (otherStat !== null && isHovered) {
            // 비교 수치 계산
            const diffFlat = (thisStat.flat || 0) - (otherStat.flat || 0)
            const diffPct = (thisStat.percent || 0) - (otherStat.percent || 0)
            const isPositive = diffFlat > 0 || (diffFlat === 0 && diffPct > 0)
            const isNeutral = diffFlat === 0 && diffPct === 0

            // 수치 텍스트 색상
            if (!isNeutral) {
                ctx.fillStyle = isPositive ? '#7dffb0' : '#ff7d7d'
            }

            // 기본 수치
            const valX = right - (isNeutral ? 0 : 60)  // 비교 배지 공간 확보
            ctx.fillText(valStr, valX, mid)

            // 비교 배지 (차이값)
            if (!isNeutral) {
                this.drawComparisonBadge(ctx, panelX, y, panelW, rowH, diffFlat, diffPct, isPositive)
            }
        } else if (otherStat !== null && !isHovered) {
            // 장착 아이템 패널: 비교 차이는 반대로 (장착 기준)
            const diffFlat = (thisStat.flat || 0) - (otherStat.flat || 0)
            const diffPct = (thisStat.percent || 0) - (otherStat.percent || 0)
            const isPositive = diffFlat > 0 || (diffFlat === 0 && diffPct > 0)
            const isNeutral = diffFlat === 0 && diffPct === 0
            if (!isNeutral) ctx.fillStyle = isPositive ? '#7dffb0' : 'rgba(200,200,200,0.7)'
            ctx.fillText(valStr, right, mid)
        } else {
            ctx.fillText(valStr, right, mid)
        }

        return y + rowH
    }

    // ─────────────────────────────────────────────────────
    //  비교 배지 (▲+5 / ▼-3)
    // ─────────────────────────────────────────────────────
    private drawComparisonBadge(
        ctx: CanvasRenderingContext2D,
        panelX: number, rowY: number, panelW: number, rowH: number,
        diffFlat: number, diffPct: number,
        isPositive: boolean
    ): void {
        const bColor = isPositive ? '#3dffa0' : '#ff5555'
        const bgColor = isPositive ? 'rgba(0,80,40,0.75)' : 'rgba(80,0,0,0.75)'
        const arrow = isPositive ? '▲' : '▼'

        let diffText = arrow + ' '
        if (diffFlat) diffText += (diffFlat > 0 ? '+' : '') + diffFlat
        if (diffPct) {
            if (diffFlat) diffText += ' '
            diffText += (diffPct > 0 ? '+' : '') + (diffPct * 100).toFixed(0) + '%'
        }

        ctx.save()
        const fontSize = 11
        ctx.font = `bold ${fontSize}px monospace`
        const tw = ctx.measureText(diffText).width
        const bw = tw + 10
        const bh = rowH - 8
        const bx = panelX + panelW - bw - 4
        const by = rowY + 4

        // 배지 배경 (그라데이션)
        const bGrad = ctx.createLinearGradient(bx, by, bx + bw, by)
        bGrad.addColorStop(0, bgColor.replace('0.75', '0.4'))
        bGrad.addColorStop(1, bgColor)
        ctx.fillStyle = bGrad
        ctx.fillRect(bx, by, bw, bh)

        // 좌측 강조 라인
        ctx.fillStyle = bColor
        ctx.fillRect(bx, by, 2, bh)

        ctx.strokeStyle = bColor + '80'
        ctx.lineWidth = 1
        ctx.strokeRect(bx, by, bw, bh)

        // 텍스트
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = bColor
        ctx.shadowColor = bColor
        ctx.shadowBlur = 4
        ctx.fillText(diffText, bx + bw / 2, by + bh / 2)
        ctx.shadowBlur = 0

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
        const rect = this.canvas.getBoundingClientRect()
        const cvsW = rect.width
        const cvsH = rect.height

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
                    hovered = true
                }
            })
        }

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

        if (mouseX < winPos.x || mouseX > winPos.x + winW || mouseY < winPos.y || mouseY > winPos.y + winH) return false

        const bSize = cfg.closeButton.width
        const bMargin = cfg.closeButton.margin
        const cx = winPos.x + winW - bSize - bMargin
        const cy = winPos.y + bMargin
        if (mouseX >= cx && mouseX <= cx + bSize && mouseY >= cy && mouseY <= cy + bSize) {
            this.player.isInventoryOpen = false
            return true
        }

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
                if (item.isEquipment()) {
                    this.player.equipItem(item)
                }
                slotClicked = true
            }
        })
        if (slotClicked) return true

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
