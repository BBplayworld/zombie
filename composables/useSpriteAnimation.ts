/**
 * 스프라이트 애니메이션 시스템
 * 스프라이트 시트에서 프레임을 추출하고 애니메이션 재생
 */

export interface SpriteFrame {
    x: number
    y: number
    width: number
    height: number
}

export interface Animation {
    name: string
    frames: SpriteFrame[]
    frameRate: number // frames per second
}

export class SpriteAnimation {
    private animations: Map<string, Animation> = new Map()
    private currentAnimation: string = ''
    private currentFrameIndex: number = 0
    private frameTimer: number = 0
    private isPlaying: boolean = false

    /**
     * 애니메이션 추가
     */
    addAnimation(animation: Animation): void {
        this.animations.set(animation.name, animation)

        // 첫 번째 애니메이션을 기본으로 설정
        if (this.currentAnimation === '') {
            this.currentAnimation = animation.name
        }
    }

    /**
     * 애니메이션 재생
     */
    play(animationName: string, restart: boolean = false): void {
        if (this.currentAnimation !== animationName || restart) {
            this.currentAnimation = animationName
            this.currentFrameIndex = 0
            this.frameTimer = 0
        }
        this.isPlaying = true
    }

    /**
     * 애니메이션 정지
     */
    stop(): void {
        this.isPlaying = false
        this.currentFrameIndex = 0
        this.frameTimer = 0
    }

    /**
     * 애니메이션 일시정지
     */
    pause(): void {
        this.isPlaying = false
    }

    /**
     * 업데이트 (deltaTime in seconds)
     */
    update(deltaTime: number): void {
        if (!this.isPlaying) return

        const animation = this.animations.get(this.currentAnimation)
        if (!animation) return

        this.frameTimer += deltaTime

        const frameDuration = 1 / animation.frameRate
        if (this.frameTimer >= frameDuration) {
            this.frameTimer -= frameDuration
            this.currentFrameIndex = (this.currentFrameIndex + 1) % animation.frames.length
        }
    }

    /**
     * 현재 프레임 가져오기
     */
    getCurrentFrame(): SpriteFrame | null {
        const animation = this.animations.get(this.currentAnimation)
        if (!animation) return null

        return animation.frames[this.currentFrameIndex]
    }

    /**
     * 현재 애니메이션 이름
     */
    getCurrentAnimationName(): string {
        return this.currentAnimation
    }

    /**
     * 재생 중인지 확인
     */
    getIsPlaying(): boolean {
        return this.isPlaying
    }
}

/**
 * 스프라이트 시트에서 프레임 배열 생성 헬퍼
 */
export function createFramesFromGrid(
    startX: number,
    startY: number,
    frameWidth: number,
    frameHeight: number,
    frameCount: number,
    columns: number
): SpriteFrame[] {
    const frames: SpriteFrame[] = []

    for (let i = 0; i < frameCount; i++) {
        const col = i % columns
        const row = Math.floor(i / columns)

        frames.push({
            x: startX + col * frameWidth,
            y: startY + row * frameHeight,
            width: frameWidth,
            height: frameHeight
        })
    }

    return frames
}
