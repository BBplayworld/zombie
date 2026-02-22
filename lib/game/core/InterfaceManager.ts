import { Player } from '../entities/Player'
import { ResourceLoader } from '../systems/ResourceLoader'

/**
 * 게임 하단 인터페이스 관리자
 *
 * 렌더 순서 (z-order):
 *   [1] hp.png → globalAlpha 0.85 배경 이미지 (z 하위)
 *   [2] 내부 어두운 fill
 *   [3] HP 게이지 fill (roundRect 곡선 + glow 그림자) ← 항상 이미지보다 앞
 *   [4] 수치 텍스트
 */
export class InterfaceManager {
    private canvas: HTMLCanvasElement

    // ── HP 바 레이아웃 ─────────────────────────────────────
    private static readonly HP_FRAME = {
        w: 140,
        h: 300,
        marginLeft: 96,
        marginBottom: 52,
        padX: 0.26,   // 좌우 각각 26 %
        padTop: 0.13,   // 상단    13 %
        padBot: 0.10,   // 하단    10 %
    }

    // ── 인벤토리 아이콘 ───────────────────────────────────
    private static readonly INV_ICON = {
        size: 128,
        offsetFromCenter: 400,   // 화면 중앙에서 오른쪽 오프셋
        marginBottom: 52,
    }

    /** 인벤토리 아이콘 히트 영역 */
    public inventoryIconRect: { x: number; y: number; w: number; h: number } | null = null

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
    }

    /**
     * 마우스 위치 기반 커서 변경
     * @returns true 이면 아이콘 위에 있음
     */
    handleHover(mouseX: number, mouseY: number): boolean {
        if (!this.inventoryIconRect) {
            this.canvas.style.cursor = 'default'
            return false
        }
        const r = this.inventoryIconRect
        const over = mouseX >= r.x && mouseX <= r.x + r.w &&
            mouseY >= r.y && mouseY <= r.y + r.h
        this.canvas.style.cursor = over ? 'pointer' : 'default'
        return over
    }

    /** 하단 HUD 전체 렌더링 */
    render(ctx: CanvasRenderingContext2D, player: Player, resourceLoader: ResourceLoader): void {
        this.renderHPBar(ctx, player, resourceLoader)
        this.renderInventoryIcon(ctx, resourceLoader)
    }

    // ─────────────────────────────────────────────────────
    //  HP 바
    // ─────────────────────────────────────────────────────

    private renderHPBar(ctx: CanvasRenderingContext2D, player: Player, resourceLoader: ResourceLoader): void {
        const ch = this.canvas.height
        const cfg = InterfaceManager.HP_FRAME

        const barX = cfg.marginLeft
        const barY = ch - cfg.marginBottom - cfg.h
        const barW = cfg.w
        const barH = cfg.h

        // 내부 영역 계산 (유저가 fine-tune한 offset 적용)
        const padX = Math.round(barW * cfg.padX)
        const padTop = Math.round(barH * cfg.padTop)
        const padBot = Math.round(barH * cfg.padBot)
        const innerX = barX + padX + 15
        const innerY = barY + padTop + 3
        const innerW = barW - padX * 2 - 30
        const innerH = barH - padTop - padBot - 10

        const hpRatio = Math.max(0, Math.min(1, player.hp / player.maxHp))
        const fillH = Math.round(innerH * hpRatio)
        const fillY = innerY + (innerH - fillH)   // 하단 → 상단

        ctx.save()

        // ── [1] hp.png 배경 이미지 (z 최하위) ────────────
        const hpFrameImg = resourceLoader.getImage('hpBar')
        if (hpFrameImg?.complete && (hpFrameImg.naturalWidth ?? 0) > 0) {
            ctx.globalAlpha = 0.85
            ctx.drawImage(hpFrameImg, barX, barY, barW, barH)
            ctx.globalAlpha = 1
        } else {
            ctx.fillStyle = 'rgba(20, 10, 10, 0.8)'
            ctx.fillRect(barX, barY, barW, barH)
            ctx.strokeStyle = 'rgba(140, 70, 30, 0.9)'
            ctx.lineWidth = 2
            ctx.strokeRect(barX, barY, barW, barH)
        }

        // ── [2] 내부 배경 (어둡게) ────────────────────────
        ctx.fillStyle = 'rgba(5, 2, 2, 0.80)'
        ctx.fillRect(innerX, innerY, innerW, innerH)

        // ── [3] HP 게이지 fill — roundRect + glow 그림자 ─
        if (fillH > 0) {
            ctx.save()
            // innerRect clip
            ctx.beginPath()
            ctx.rect(innerX, innerY, innerW, innerH)
            ctx.clip()

            // 세로 그라데이션
            const grad = ctx.createLinearGradient(0, fillY, 0, fillY + fillH)
            if (hpRatio > 0.6) {
                grad.addColorStop(0, '#ff7235')
                grad.addColorStop(0.5, '#cc1520')
                grad.addColorStop(1, '#4a0000')
            } else if (hpRatio > 0.3) {
                grad.addColorStop(0, '#ff4500')
                grad.addColorStop(1, '#330000')
            } else {
                grad.addColorStop(0, '#ff1515')
                grad.addColorStop(1, '#1a0000')
            }

            // 붉은 glow 그림자 (게이지에만 적용)
            ctx.shadowColor = hpRatio > 0.3 ? 'rgba(255, 60, 0, 0.55)' : 'rgba(255, 0, 0, 0.65)'
            ctx.shadowBlur = 10
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 2

            // 상단 모서리만 둥글게
            const r = Math.min(4, fillH / 2)
            ctx.fillStyle = grad
            ctx.beginPath()
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(innerX, fillY, innerW, fillH, [r, r, 0, 0])
            } else {
                ctx.rect(innerX, fillY, innerW, fillH)
            }
            ctx.fill()

            // 그림자 리셋 후 하이라이트
            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0

            // 좌측 유리 하이라이트 (세로)
            const hlG = ctx.createLinearGradient(innerX, 0, innerX + innerW, 0)
            hlG.addColorStop(0, 'rgba(255,255,255,0.22)')
            hlG.addColorStop(0.4, 'rgba(255,255,255,0.05)')
            hlG.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = hlG
            ctx.beginPath()
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(innerX, fillY, innerW, fillH, [r, r, 0, 0])
            } else {
                ctx.rect(innerX, fillY, innerW, fillH)
            }
            ctx.fill()

            // 상단 가로 하이라이트 선
            if (fillH > 4) {
                ctx.globalAlpha = 0.50
                ctx.fillStyle = 'rgba(255, 210, 160, 0.9)'
                ctx.fillRect(innerX + r, fillY + 1, innerW - r * 2, 2)
                ctx.globalAlpha = 1
            }

            ctx.restore()
        }

        ctx.restore()

        // ── [4] 수치 텍스트 ───────────────────────────────
        this.renderHPText(ctx, player, barX, barY + barH + 10, barW, hpRatio)
    }

    /**
     * HP 텍스트: "현재 / 최대" + "(▲ N/s)"
     */
    private renderHPText(
        ctx: CanvasRenderingContext2D,
        player: Player,
        barX: number,
        baseY: number,
        barW: number,
        hpRatio: number
    ): void {
        const cx = barX + barW / 2

        const hpColor = hpRatio > 0.6 ? '#f0c0c0'
            : hpRatio > 0.3 ? '#ff8844'
                : '#ff3333'

        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.shadowColor = 'rgba(0,0,0,0.9)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 1

        ctx.font = 'bold 13px monospace'
        ctx.fillStyle = hpColor
        ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, cx, baseY)

        if (player.hpRegen > 0) {
            ctx.font = '11px monospace'
            ctx.fillStyle = 'rgba(60, 210, 100, 0.9)'
            ctx.fillText(`▲ ${player.hpRegen.toFixed(1)}/s`, cx, baseY + 18)
        }

        ctx.restore()
    }

    // ─────────────────────────────────────────────────────
    //  인벤토리 아이콘
    // ─────────────────────────────────────────────────────

    private renderInventoryIcon(ctx: CanvasRenderingContext2D, resourceLoader: ResourceLoader): void {
        const cw = this.canvas.width
        const ch = this.canvas.height
        const cfg = InterfaceManager.INV_ICON
        const size = cfg.size

        const iconX = Math.floor(cw / 2) + cfg.offsetFromCenter
        const iconY = ch - size - cfg.marginBottom

        this.inventoryIconRect = { x: iconX, y: iconY, w: size, h: size }

        const invImg = resourceLoader.getImage('inventoryIcon')
        if (!invImg?.complete || (invImg.naturalWidth ?? 0) === 0) return

        ctx.save()
        ctx.shadowColor = 'rgba(255, 210, 80, 0.4)'
        ctx.shadowBlur = 16
        ctx.drawImage(invImg, iconX, iconY, size, size)
        ctx.shadowBlur = 0
        ctx.shadowColor = 'transparent'

        ctx.font = 'bold 11px monospace'
        ctx.fillStyle = 'rgba(210, 190, 100, 0.82)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.shadowColor = 'rgba(0,0,0,0.85)'
        ctx.shadowBlur = 5
        ctx.fillText('[I]', iconX + size / 2, iconY + size + 16)
        ctx.restore()
    }
}
