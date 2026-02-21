import { Vector2 } from '../utils/math'

/**
 * 카메라 시스템
 * 플레이어를 따라다니며 월드 좌표를 스크린 좌표로 변환
 */
/** 카메라가 한 번에 비추는 월드 크기 (고정 시점 = 2048) */
export const CAMERA_VIEW_SIZE = 2048

export class Camera {
    public position: Vector2
    public width: number
    public height: number

    /** 1 픽셀당 월드 단위 = 1/scale. scale 작을수록 넓은 영역이 보임 */
    public scale: number = 1

    public smoothing: number = 0.1
    public targetPosition: Vector2

    constructor(width: number, height: number) {
        this.width = width
        this.height = height
        this.position = new Vector2(0, 0)
        this.targetPosition = new Vector2(0, 0)
    }

    /** 카메라 시점 크기(CAMERA_VIEW_SIZE) 기준으로 스케일 고정. 플레이어 움직임과 무관하게 동일한 시점 유지 */
    setScaleToViewSize(): void {
        this.scale = Math.min(this.width, this.height) / CAMERA_VIEW_SIZE
    }

    follow(target: { x: number, y: number }, immediate: boolean = false): void {
        this.targetPosition.x = target.x - this.width / 2 / this.scale
        this.targetPosition.y = target.y - this.height / 2 / this.scale

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
