import { Monster } from '../entities/Monster'
import { Vector2 } from '../utils/math'

interface MapRect { x: number; y: number; w: number; h: number }

/**
 * 미니맵 시스템
 * - 실제 맵 이미지(map-1_3072.png) 축소판을 배경으로 렌더링
 * - 이동 가능 폴리곤 영역만 표시, 외부는 짙은 어두운 마스크 처리
 * - 마우스 휠 줌 / 드래그 지원
 */
export class MiniMap {
    private canvas: HTMLCanvasElement

    // 표시 설정
    private readonly SIZE    = 210
    private readonly MARGIN  = 15
    private readonly CORNER_R = 8
    private readonly MIN_ZOOM = 0.3
    private readonly MAX_ZOOM = 6.0

    // 맵 데이터
    private polygon: { x: number; y: number }[] = []
    private worldBounds: { minX: number; maxX: number; minY: number; maxY: number } = {
        minX: -1400, maxX: 1400, minY: -1400, maxY: 1400
    }

    // 실제 맵 이미지 (worldSize 기준 중심 배치)
    private mapImage: HTMLImageElement | null = null
    private mapHalfW: number = 1536  // worldSize.width  / 2
    private mapHalfH: number = 1536  // worldSize.height / 2

    // 뷰 상태
    private zoom: number = 1.0
    private viewCenter: { x: number; y: number } = { x: 0, y: 0 }

    // 드래그 상태
    private isDragging: boolean = false
    private dragStartMouse: { x: number; y: number } = { x: 0, y: 0 }
    private dragStartCenter: { x: number; y: number } = { x: 0, y: 0 }

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
    }

    setMapPolygon(polygon: { x: number; y: number }[]): void {
        this.polygon = polygon
    }

    setWorldBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void {
        this.worldBounds = bounds
        this.viewCenter = {
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2
        }
    }

    /**
     * 실제 맵 이미지 설정
     * @param img  로드된 mapBackground 이미지
     * @param worldWidth  worldSize.width  (이미지가 커버하는 월드 너비)
     * @param worldHeight worldSize.height
     */
    setMapImage(img: HTMLImageElement, worldWidth: number, worldHeight: number): void {
        this.mapImage = img
        this.mapHalfW = worldWidth  / 2
        this.mapHalfH = worldHeight / 2
    }

    // ── 좌표 변환 ──────────────────────────────────────────────

    getRect(): MapRect {
        return {
            x: this.canvas.width - this.SIZE - this.MARGIN,
            y: this.MARGIN,
            w: this.SIZE,
            h: this.SIZE
        }
    }

    private worldToMini(wx: number, wy: number): { x: number; y: number } {
        const r = this.getRect()
        const s = this.getScale()
        return {
            x: (wx - this.viewCenter.x) * s + r.x + r.w / 2,
            y: (wy - this.viewCenter.y) * s + r.y + r.h / 2
        }
    }

    private miniToWorld(mx: number, my: number): { x: number; y: number } {
        const r = this.getRect()
        const s = this.getScale()
        return {
            x: (mx - r.x - r.w / 2) / s + this.viewCenter.x,
            y: (my - r.y - r.h / 2) / s + this.viewCenter.y
        }
    }

    private getScale(): number {
        const rangeX = this.worldBounds.maxX - this.worldBounds.minX
        const rangeY = this.worldBounds.maxY - this.worldBounds.minY
        return (this.SIZE / Math.max(rangeX, rangeY)) * this.zoom
    }

    isHit(sx: number, sy: number): boolean {
        const r = this.getRect()
        return sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h
    }

    // ── 이벤트 핸들러 ──────────────────────────────────────────

    handleWheel(e: WheelEvent): boolean {
        const rect = this.canvas.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        if (!this.isHit(sx, sy)) return false

        const worldBefore = this.miniToWorld(sx, sy)
        const factor = e.deltaY < 0 ? 1.18 : 0.85
        this.zoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom * factor))
        const worldAfter = this.miniToWorld(sx, sy)

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
        this.dragStartMouse  = { x: sx, y: sy }
        this.dragStartCenter = { ...this.viewCenter }
        return true
    }

    handleMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return
        const rect = this.canvas.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        const s = this.getScale()
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
        monsters: Monster[]
    ): void {
        const r = this.getRect()

        ctx.save()

        // ── 1. 미니맵 둥근 사각형 클립 ──
        ctx.beginPath()
        ctx.roundRect(r.x, r.y, r.w, r.h, this.CORNER_R)
        ctx.clip()

        // ── 2. 전체 배경 (폴리곤 외부 = 짙은 검정) ──
        ctx.fillStyle = 'rgba(6, 8, 6, 0.96)'
        ctx.fillRect(r.x, r.y, r.w, r.h)

        // ── 3. 이동 가능 폴리곤 내부: 실제 맵 이미지 표시 ──
        if (this.polygon.length >= 3) {
            ctx.save()

            // 3-a. 폴리곤으로 클립
            ctx.beginPath()
            this.polygon.forEach((pt, i) => {
                const mp = this.worldToMini(pt.x, pt.y)
                i === 0 ? ctx.moveTo(mp.x, mp.y) : ctx.lineTo(mp.x, mp.y)
            })
            ctx.closePath()
            ctx.clip()

            if (this.mapImage && this.mapImage.complete && this.mapImage.naturalWidth > 0) {
                // 3-b. 실제 맵 이미지 렌더링 (월드 전체 영역에 맞게 스케일)
                // 맵 이미지는 월드 (-mapHalfW, -mapHalfH) ~ (+mapHalfW, +mapHalfH) 를 커버
                const tl = this.worldToMini(-this.mapHalfW, -this.mapHalfH)
                const br = this.worldToMini( this.mapHalfW,  this.mapHalfH)
                const imgW = br.x - tl.x
                const imgH = br.y - tl.y

                ctx.drawImage(this.mapImage, tl.x, tl.y, imgW, imgH)

                // 3-c. 약한 어둠 오버레이로 가독성 확보
                ctx.fillStyle = 'rgba(0, 0, 0, 0.30)'
                ctx.fillRect(r.x, r.y, r.w, r.h)
            } else {
                // 폴백: 초록 그라데이션
                const cx = r.x + r.w / 2
                const cy = r.y + r.h / 2
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r.w * 0.6)
                grad.addColorStop(0, 'rgba(60, 90, 55, 0.9)')
                grad.addColorStop(1, 'rgba(35, 55, 30, 0.9)')
                ctx.fillStyle = grad
                ctx.fillRect(r.x, r.y, r.w, r.h)
            }

            ctx.restore()

            // 3-d. 폴리곤 테두리 (폴리곤 클립 밖에서 그려야 전체 선이 보임)
            ctx.beginPath()
            this.polygon.forEach((pt, i) => {
                const mp = this.worldToMini(pt.x, pt.y)
                i === 0 ? ctx.moveTo(mp.x, mp.y) : ctx.lineTo(mp.x, mp.y)
            })
            ctx.closePath()
            ctx.strokeStyle = 'rgba(200, 230, 180, 0.55)'
            ctx.lineWidth = 1.2
            ctx.stroke()
        }

        // ── 4. 몬스터 점 ──
        monsters.forEach(m => {
            if (m.isDead) return
            const mp = this.worldToMini(m.position.x, m.position.y)
            if (mp.x < r.x || mp.x > r.x + r.w || mp.y < r.y || mp.y > r.y + r.h) return

            ctx.fillStyle = 'rgba(230, 60, 60, 0.92)'
            ctx.beginPath()
            ctx.arc(mp.x, mp.y, 3, 0, Math.PI * 2)
            ctx.fill()
        })

        // ── 5. 플레이어 점 (시야 원 포함) ──
        const pp = this.worldToMini(playerPos.x, playerPos.y)
        if (pp.x >= r.x && pp.x <= r.x + r.w && pp.y >= r.y && pp.y <= r.y + r.h) {
            const viewR = 120 * this.getScale()
            const viewGrad = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, viewR)
            viewGrad.addColorStop(0, 'rgba(255, 255, 100, 0.10)')
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

        // ── 6. 테두리 (클립 바깥) ──
        ctx.save()
        ctx.strokeStyle = 'rgba(180, 210, 160, 0.55)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(r.x, r.y, r.w, r.h, this.CORNER_R)
        ctx.stroke()

        // ── 7. 헤더 ──
        ctx.fillStyle = 'rgba(6, 8, 6, 0.75)'
        ctx.fillRect(r.x, r.y, r.w, 18)
        ctx.fillStyle = 'rgba(200, 220, 175, 0.92)'
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('MINIMAP', r.x + r.w / 2, r.y + 9)

        // ── 8. 줌 레벨 ──
        ctx.fillStyle = 'rgba(170, 190, 150, 0.75)'
        ctx.font = '9px monospace'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`x${this.zoom.toFixed(1)}`, r.x + r.w - 4, r.y + r.h - 3)

        // ── 9. 조작 힌트 (줌 ≤ 0.5 일 때) ──
        if (this.zoom <= 0.5) {
            ctx.fillStyle = 'rgba(255, 255, 200, 0.5)'
            ctx.font = '8px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('scroll: zoom  drag: pan', r.x + r.w / 2, r.y + r.h - 3)
        }

        ctx.restore()
    }
}
