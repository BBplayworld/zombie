import { SpriteAnimation, createFramesFromGrid } from '../systems/SpriteAnimation'
import { SPRITE } from '../config/constants'

/**
 * 애니메이션 설정 공통 유틸리티
 * 플레이어와 몬스터의 애니메이션 설정을 통일
 */

// ============================================================================
// 기본 애니메이션 설정 (3x3 그리드)
// ============================================================================

/**
 * 기본 이동/대기 애니메이션 설정
 * 플레이어와 몬스터 모두 동일한 3x3 스프라이트 구조 사용
 * 
 * @param spriteAnimation 스프라이트 애니메이션 인스턴스
 * @param frameRate 프레임 레이트 (기본값: 걷기 8, 몬스터 6)
 */
export function setupBasicAnimations(
    spriteAnimation: SpriteAnimation,
    walkFrameRate: number = SPRITE.WALK_FRAME_RATE
): void {
    const frameWidth = SPRITE.BASIC_FRAME_WIDTH
    const frameHeight = SPRITE.BASIC_FRAME_HEIGHT

    // 걷기 애니메이션 (3프레임)
    spriteAnimation.addAnimation({
        name: 'walk_down',
        frames: createFramesFromGrid(0, 0, frameWidth, frameHeight, 3, 3),
        frameRate: walkFrameRate
    })

    spriteAnimation.addAnimation({
        name: 'walk_left',
        frames: createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 3, 3),
        frameRate: walkFrameRate
    })

    spriteAnimation.addAnimation({
        name: 'walk_right',
        frames: createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 3, 3),
        frameRate: walkFrameRate
    })

    // 대기 애니메이션 (1프레임)
    spriteAnimation.addAnimation({
        name: 'idle_down',
        frames: [createFramesFromGrid(0, 0, frameWidth, frameHeight, 1, 3)[0]],
        frameRate: SPRITE.IDLE_FRAME_RATE
    })

    spriteAnimation.addAnimation({
        name: 'idle_left',
        frames: [createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 1, 3)[0]],
        frameRate: SPRITE.IDLE_FRAME_RATE
    })

    spriteAnimation.addAnimation({
        name: 'idle_right',
        frames: [createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 1, 3)[0]],
        frameRate: SPRITE.IDLE_FRAME_RATE
    })
}

// ============================================================================
// 전투 애니메이션 설정 (5x5 그리드)
// ============================================================================

/**
 * 전투 애니메이션 설정
 * 플레이어 전투 스프라이트 (5x5 그리드)
 * 
 * @param spriteAnimation 스프라이트 애니메이션 인스턴스
 * @param fightImage 전투 이미지
 */
export function setupFightAnimations(
    spriteAnimation: SpriteAnimation,
    fightImage: HTMLImageElement
): void {
    const totalWidth = fightImage.naturalWidth
    const totalHeight = fightImage.naturalHeight
    const cols = SPRITE.FIGHT_GRID_COLS
    const rows = SPRITE.FIGHT_GRID_ROWS

    const frameWidth = totalWidth / cols
    const frameHeight = totalHeight / rows

    // 공격 애니메이션 (각 방향별 5프레임)
    // Row 0: Attack Down
    spriteAnimation.addAnimation({
        name: 'attack_down',
        frames: createFramesFromGrid(0, 0, frameWidth, frameHeight, 5, cols),
        frameRate: SPRITE.ATTACK_FRAME_RATE,
        loop: false
    })

    // Row 1: Attack Left
    spriteAnimation.addAnimation({
        name: 'attack_left',
        frames: createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 5, cols),
        frameRate: SPRITE.ATTACK_FRAME_RATE,
        loop: false
    })

    // Row 2: Attack Right
    spriteAnimation.addAnimation({
        name: 'attack_right',
        frames: createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 5, cols),
        frameRate: SPRITE.ATTACK_FRAME_RATE,
        loop: false
    })

    // Row 3: Attack Up
    spriteAnimation.addAnimation({
        name: 'attack_up',
        frames: createFramesFromGrid(0, frameHeight * 3, frameWidth, frameHeight, 5, cols),
        frameRate: SPRITE.ATTACK_FRAME_RATE,
        loop: false
    })
}

// ============================================================================
// 애니메이션 재생 헬퍼
// ============================================================================

/**
 * 현재 상태에 맞는 애니메이션 재생
 * 
 * @param spriteAnimation 스프라이트 애니메이션 인스턴스
 * @param isMoving 이동 중인지 여부
 * @param direction 현재 방향
 */
export function playStateAnimation(
    spriteAnimation: SpriteAnimation,
    isMoving: boolean,
    direction: 'idle' | 'up' | 'down' | 'left' | 'right'
): void {
    if (isMoving) {
        const animName = `walk_${direction}`
        spriteAnimation.play(animName)
    } else {
        // up 방향은 left 애니메이션 사용
        const idleDirection = direction === 'up' ? 'left' : direction
        const animName = `idle_${idleDirection}`
        spriteAnimation.play(animName)
    }
}

/**
 * 공격 애니메이션 재생
 * 
 * @param spriteAnimation 스프라이트 애니메이션 인스턴스
 * @param direction 공격 방향
 * @param onComplete 애니메이션 완료 콜백
 */
export function playAttackAnimation(
    spriteAnimation: SpriteAnimation,
    direction: 'idle' | 'up' | 'down' | 'left' | 'right',
    onComplete: () => void
): void {
    const animName = `attack_${direction}`
    spriteAnimation.playOnce(animName, onComplete)
}
