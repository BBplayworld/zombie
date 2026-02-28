import { Monster } from '../entities/monster/Monster'
import { Vector2 } from '../utils/math'

interface MapRect { x: number; y: number; w: number; h: number }

/**
 * 미니맵 시스템 (단일 맵 이미지 기반)
 * - 한 장의 맵 이미지를 축소해 배경으로 표시 (zone 맵 이미지 형태와 동일)
 * - 항상 zone 맵 이미지 우상단에 배치 (mapRect 기준)
 * - 맵 이미지를 벗어나지 않도록 위치 클램프
 * - 휠 줌 / 드래그 지원
 */
export class MiniMap {
    private canvas: HTMLCanvasElement

    private readonly SIZE = 240
    private readonly MARGIN = 12
    private readonly CORNER_R = 6
    private readonly MIN_ZOOM = 0.3
    private readonly MAX_ZOOM = 6.0

    private polygons: { x: number; y: number }[][] = []
    private worldBounds: { minX: number; maxX: number; minY: number; maxY: number } = {
        minX: -1400, maxX: 1400, minY: -1400, maxY: 1400
    }

    /** 단일 맵 이미지 (전체 월드 1장) */
    private mapImage: HTMLImageElement | null = null
    private mapHalfW: number = 1024
    private mapHalfH: number = 1024

    // 뷰 상태
    private zoom: number = 1.0
    private viewCenter: { x: number; y: number } = { x: 0, y: 0 }

    // 드래그 상태
    private isDragging: boolean = false
    private dragStartMouse: { x: number; y: number } = { x: 0, y: 0 }
    private dragStartCenter: { x: number; y: number } = { x: 0, y: 0 }

    // 로케일 (미니맵 텍스트)
    private locale: 'ko' | 'en' = 'en'
    private static readonly LOCALE_TEXTS: Record<'ko' | 'en', { title: string; hint: string }> = {
        ko: { title: '미니맵', hint: '휠: 확대/축소' },
        en: { title: 'MINIMAP', hint: 'scroll: zoom' },
    }

    /** 마지막 렌더링 때 사용된 mapRect (이벤트 핸들러용) */
    private lastMapRect: MapRect | null = null

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
    }

    setLocale(locale: 'ko' | 'en'): void {
        this.locale = locale
    }

    setMapPolygon(polygon: { x: number; y: number }[] | { x: number; y: number }[][]): void {
        const first = polygon[0]
        const isMulti = Array.isArray(first) && first.length > 0 && typeof (first as { x?: number }[])[0] === 'object'
        this.polygons = isMulti ? (polygon as { x: number; y: number }[][]) : [polygon as { x: number; y: number }[]]
    }

    setWorldBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void {
        this.worldBounds = bounds
        this.viewCenter = {
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2
        }
    }

    /** 단일 맵 이미지 설정 (월드 크기 = 이미지가 커버하는 범위) */
    setMapImage(img: HTMLImageElement, worldWidth: number, worldHeight: number): void {
        this.mapImage = img
        this.mapHalfW = worldWidth / 2
        this.mapHalfH = worldHeight / 2
    }

    // ── 좌표 변환 ──────────────────────────────────────────────

    /**
     * 미니맵 사각형 반환.
     * mapRect가 있으면 맵 이미지 우상단에 배치 (맵 밖으로 나가지 않게 클램프).
     * mapRect가 없으면 캔버스 우상단 폴백.
     */
    getRect(mapRect?: MapRect): MapRect {
        if (mapRect) {
            // 맵 이미지 우상단에 배치, 맵 범위를 벗어나지 않음
            const x = mapRect.x + mapRect.w - this.SIZE - this.MARGIN
            const y = mapRect.y + this.MARGIN
            // 클램프: 맵 이미지 내부에만 배치
            const clampedX = Math.max(mapRect.x + this.MARGIN, Math.min(x, mapRect.x + mapRect.w - this.SIZE - this.MARGIN))
            const clampedY = Math.max(mapRect.y + this.MARGIN, y)
            // 미니맵이 맵 하단을 벗어나지 않도록
            const maxH = mapRect.h - this.MARGIN * 2
            const actualSize = Math.min(this.SIZE, maxH)
            return { x: clampedX, y: clampedY, w: actualSize, h: actualSize }
        }

        // 폴백: 캔버스 우상단
        const rect = this.canvas.getBoundingClientRect()
        return {
            x: rect.width - this.SIZE - this.MARGIN,
            y: this.MARGIN,
            w: this.SIZE,
            h: this.SIZE
        }
    }

    private worldToMini(wx: number, wy: number, r: MapRect): { x: number; y: number } {
        const s = this.getScale(r)
        return {
            x: (wx - this.viewCenter.x) * s + r.x + r.w / 2,
            y: (wy - this.viewCenter.y) * s + r.y + r.h / 2
        }
    }

    private miniToWorld(mx: number, my: number, r: MapRect): { x: number; y: number } {
        const s = this.getScale(r)
        return {
            x: (mx - r.x - r.w / 2) / s + this.viewCenter.x,
            y: (my - r.y - r.h / 2) / s + this.viewCenter.y
        }
    }

    private getScale(r: MapRect): number {
        const rangeX = this.worldBounds.maxX - this.worldBounds.minX
        const rangeY = this.worldBounds.maxY - this.worldBounds.minY
        return (r.w / Math.max(rangeX, rangeY)) * this.zoom
    }

    isHit(sx: number, sy: number): boolean {
        const r = this.lastMapRect ?? this.getRect()
        return sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h
    }

    // ── 이벤트 핸들러 ──────────────────────────────────────────

    handleWheel(e: WheelEvent): boolean {
        const rect = this.canvas.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        if (!this.isHit(sx, sy)) return false

        const r = this.lastMapRect ?? this.getRect()
        const worldBefore = this.miniToWorld(sx, sy, r)
        const factor = e.deltaY < 0 ? 1.18 : 0.85
        this.zoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom * factor))
        const worldAfter = this.miniToWorld(sx, sy, r)

        this.viewCenter.x += worldBefore.x - worldAfter.x
        this.viewCenter.y += worldBefore.y - worldAfter.y

        e.preventDefault()
        return true
    }

    handleMouseDown(e: MouseEvent): boolean {
        const rect = this.canvas.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        if (!this.isHit(sx, sy)) return false

        this.isDragging = true
        this.dragStartMouse = { x: sx, y: sy }
        this.dragStartCenter = { ...this.viewCenter }
        return true
    }

    handleMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return
        const rect = this.canvas.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        const r = this.lastMapRect ?? this.getRect()
        const s = this.getScale(r)
        this.viewCenter.x = this.dragStartCenter.x - (sx - this.dragStartMouse.x) / s
        this.viewCenter.y = this.dragStartCenter.y - (sy - this.dragStartMouse.y) / s
    }

    handleMouseUp(): void {
        this.isDragging = false
    }

    // ── 렌더링 ─────────────────────────────────────────────────

    render(
        ctx: CanvasRenderingContext2D,
        playerPos: Vector2 | { x: number; y: number },
        monsters: Monster[],
        mapRect?: MapRect
    ): void {
        const r = this.getRect(mapRect)
        this.lastMapRect = r // 이벤트 핸들러에서 재사용

        ctx.save()

        // ── 1. 미니맵 테두리 + 배경 (맵 이미지 형태: 둥근 사각형) ──
        ctx.beginPath()
        ctx.roundRect(r.x, r.y, r.w, r.h, this.CORNER_R)
        ctx.clip()

        // ── 2. 전체 배경 ──
        ctx.fillStyle = 'rgba(6, 8, 6, 0.92)'
        ctx.fillRect(r.x, r.y, r.w, r.h)

        // ── 3. 맵 이미지 표시 (zone 맵 이미지와 동일한 형태) ──
        const hasMapImg = this.mapImage?.complete && (this.mapImage?.naturalWidth ?? 0) > 0

        if (hasMapImg && this.mapImage) {
            // 전체 맵 이미지를 미니맵 영역에 맞게 축소 렌더링
            const tl = this.worldToMini(-this.mapHalfW, -this.mapHalfH, r)
            const br = this.worldToMini(this.mapHalfW, this.mapHalfH, r)
            const fullW = br.x - tl.x
            const fullH = br.y - tl.y

            if (fullW > 0 && fullH > 0) {
                // 맵 이미지 전체를 표시 (어두운 오버레이 추가로 미니맵 느낌)
                ctx.drawImage(this.mapImage, tl.x, tl.y, fullW, fullH)
                ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
                ctx.fillRect(r.x, r.y, r.w, r.h)
            }
        } else {
            // 이미지 없을 때의 그라데이션 배경
            const cx = r.x + r.w / 2
            const cy = r.y + r.h / 2
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r.w * 0.6)
            grad.addColorStop(0, 'rgba(60, 90, 55, 0.9)')
            grad.addColorStop(1, 'rgba(35, 55, 30, 0.9)')
            ctx.fillStyle = grad
            ctx.fillRect(r.x, r.y, r.w, r.h)
        }

        // ── 4. 몬스터 점 ──
        monsters.forEach(m => {
            if (m.isDead) return
            const mp = this.worldToMini(m.position.x, m.position.y, r)
            if (mp.x < r.x || mp.x > r.x + r.w || mp.y < r.y || mp.y > r.y + r.h) return

            ctx.fillStyle = 'rgba(230, 60, 60, 0.92)'
            ctx.beginPath()
            ctx.arc(mp.x, mp.y, 3, 0, Math.PI * 2)
            ctx.fill()
        })

        // ── 5. 플레이어 점 (시야 원 포함) ──
        const pp = this.worldToMini(playerPos.x, playerPos.y, r)
        if (pp.x >= r.x && pp.x <= r.x + r.w && pp.y >= r.y && pp.y <= r.y + r.h) {
            const viewR = 120 * this.getScale(r)
            const viewGrad = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, viewR)
            viewGrad.addColorStop(0, 'rgba(255, 255, 100, 0.12)')
            viewGrad.addColorStop(1, 'rgba(255, 255, 100, 0)')
            ctx.fillStyle = viewGrad
            ctx.beginPath()
            ctx.arc(pp.x, pp.y, viewR, 0, Math.PI * 2)
            ctx.fill()

            ctx.fillStyle = '#ffee44'
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(pp.x, pp.y, 5, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
        }

        ctx.restore() // 미니맵 클립 해제

        // ── 6. 테두리 외곽선 (맵 이미지와 동일한 느낌) ──
        ctx.save()
        ctx.strokeStyle = 'rgba(180, 200, 160, 0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(r.x, r.y, r.w, r.h, this.CORNER_R)
        ctx.stroke()

        // ── 7. 타이틀 바 (맵 이미지 상단과 동일한 높이) ──
        const texts = MiniMap.LOCALE_TEXTS[this.locale]
        ctx.fillStyle = 'rgba(6, 8, 6, 0.80)'
        // 타이틀 바 배경을 둥근 사각형 상단에만
        ctx.beginPath()
        ctx.roundRect(r.x, r.y, r.w, 18, [this.CORNER_R, this.CORNER_R, 0, 0])
        ctx.fill()

        ctx.fillStyle = 'rgba(200, 220, 175, 0.95)'
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(texts.title, r.x + r.w / 2, r.y + 9)

        // 줌 표시 (우하단)
        ctx.fillStyle = 'rgba(170, 190, 150, 0.80)'
        ctx.font = '9px monospace'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`x${this.zoom.toFixed(1)}`, r.x + r.w - 4, r.y + r.h - 3)

        if (this.zoom <= 0.5) {
            ctx.fillStyle = 'rgba(255, 255, 200, 0.5)'
            ctx.font = '8px monospace'
            ctx.textAlign = 'center'
            ctx.fillText(texts.hint, r.x + r.w / 2, r.y + r.h - 3)
        }

        ctx.restore()
    }
}
