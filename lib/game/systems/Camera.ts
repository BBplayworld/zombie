import { Vector2 } from '../utils/math'

/**
 * 카메라 시스템
 * 플레이어를 따라다니며 월드 좌표를 스크린 좌표로 변환
 */
/** 카메라가 한 번에 비추는 월드 크기 (1024, 원래 2048이었으나 레티나 맵 사이즈 대응용) */
export const CAMERA_VIEW_SIZE = 2048

export class Camera {
    public position: Vector2
    public width: number
    public height: number

    /** 1 픽셀당 월드 단위 = 1/scale. scale 작을수록 넓은 영역이 보임 */
    public scale: number = 1

    /** 카메라가 한 번에 비추는 기준 월드 크기 (챕터별로 오버라이드 가능) */
    public viewSize: number = CAMERA_VIEW_SIZE

    public smoothing: number = 0.1
    public targetPosition: Vector2

    // Bound limits for camera (e.g. zone maps)
    public bounds: { minX: number, maxX: number, minY: number, maxY: number } | null = null
    public isZoneMode: boolean = false;

    constructor(width: number, height: number) {
        this.width = width
        this.height = height
        this.position = new Vector2(0, 0)
        this.targetPosition = new Vector2(0, 0)
    }

    setBounds(minX: number, maxX: number, minY: number, maxY: number) {
        this.bounds = { minX, maxX, minY, maxY }
    }

    /** 카메라 시점 스케일 (현재 창 크기에 비례해 넓은 시야 확보) */
    setScaleToViewSize(): void {
        if (this.isZoneMode) {
            // Zone 맵일 경우 왜곡 없이 원본 1:1 출력 (단, 모니터가 너무 작으면 거기에 맞출 수도 있음)
            // 브라우저 창이 맵보다 크면 Camera의 follow 수학적 계산에 의해 정확히 중앙에 배치됨
            this.scale = 1;
        } else {
            this.scale = Math.min(this.width, this.height) / this.viewSize
        }
    }

    follow(target: { x: number, y: number }, immediate: boolean = false): void {
        let tx = target.x - this.width / 2 / this.scale
        let ty = target.y - this.height / 2 / this.scale

        if (this.bounds) {
            const viewW = this.width / this.scale
            const viewH = this.height / this.scale
            const bw = this.bounds.maxX - this.bounds.minX
            const bh = this.bounds.maxY - this.bounds.minY

            // 맵 너비가 화면보다 작으면 중앙
            if (bw < viewW) {
                tx = this.bounds.minX + bw / 2 - viewW / 2
            } else {
                tx = Math.max(this.bounds.minX, Math.min(tx, this.bounds.maxX - viewW))
            }

            // 맵 높이가 화면보다 작으면 중앙
            if (bh < viewH) {
                ty = this.bounds.minY + bh / 2 - viewH / 2 + 20
            } else {
                ty = Math.max(this.bounds.minY, Math.min(ty, this.bounds.maxY - viewH))
            }
        }

        this.targetPosition.x = tx
        this.targetPosition.y = ty

        if (immediate) {
            this.position.x = this.targetPosition.x
            this.position.y = this.targetPosition.y
        } else {
            this.position.x += (this.targetPosition.x - this.position.x) * this.smoothing
            this.position.y += (this.targetPosition.y - this.position.y) * this.smoothing
        }
    }

    worldToScreen(worldX: number, worldY: number): { x: number, y: number } {
        return {
            x: (worldX - this.position.x) * this.scale,
            y: (worldY - this.position.y) * this.scale
        }
    }

    screenToWorld(screenX: number, screenY: number): { x: number, y: number } {
        return {
            x: this.position.x + screenX / this.scale,
            y: this.position.y + screenY / this.scale
        }
    }

    resize(width: number, height: number): void {
        this.width = width
        this.height = height
    }

    isInView(x: number, y: number, width: number, height: number, padding: number = 100): boolean {
        const vw = this.width / this.scale
        const vh = this.height / this.scale
        return (
            x + width > this.position.x - padding &&
            x < this.position.x + vw + padding &&
            y + height > this.position.y - padding &&
            y < this.position.y + vh + padding
        )
    }
}
