import { Vector2 } from '../utils/math'

/**
 * 카메라 시스템
 * 플레이어를 따라다니며 월드 좌표를 스크린 좌표로 변환
 */
export class Camera {
    public position: Vector2
    public width: number
    public height: number

    // 카메라 스무스 이동 설정
    public smoothing: number = 0.1
    public targetPosition: Vector2

    constructor(width: number, height: number) {
        this.width = width
        this.height = height
        this.position = new Vector2(0, 0)
        this.targetPosition = new Vector2(0, 0)
    }

    /**
     * 타겟(플레이어)을 화면 중앙에 오도록 카메라 이동
     */
    follow(target: { x: number, y: number }, immediate: boolean = false): void {
        this.targetPosition.x = target.x - this.width / 2
        this.targetPosition.y = target.y - this.height / 2

        if (immediate) {
            this.position.x = this.targetPosition.x
            this.position.y = this.targetPosition.y
        } else {
            // 부드러운 카메라 이동
            this.position.x += (this.targetPosition.x - this.position.x) * this.smoothing
            this.position.y += (this.targetPosition.y - this.position.y) * this.smoothing
        }
    }

    /**
     * 월드 좌표를 스크린 좌표로 변환
     */
    worldToScreen(worldX: number, worldY: number): { x: number, y: number } {
        return {
            x: worldX - this.position.x,
            y: worldY - this.position.y
        }
    }

    /**
     * 스크린 좌표를 월드 좌표로 변환
     */
    screenToWorld(screenX: number, screenY: number): { x: number, y: number } {
        return {
            x: screenX + this.position.x,
            y: screenY + this.position.y
        }
    }

    /**
     * 화면 크기 업데이트
     */
    resize(width: number, height: number): void {
        this.width = width
        this.height = height
    }

    /**
     * 특정 객체가 카메라 뷰포트 안에 있는지 확인 (컬링용)
     */
    isInView(x: number, y: number, width: number, height: number, padding: number = 100): boolean {
        return (
            x + width > this.position.x - padding &&
            x < this.position.x + this.width + padding &&
            y + height > this.position.y - padding &&
            y < this.position.y + this.height + padding
        )
    }
}
