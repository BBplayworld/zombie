import { SpriteAnimation, createFramesFromGrid } from '../../systems/SpriteAnimation';

export function setupMonsterAnimations(spriteAnimation: SpriteAnimation): void {
    const frameWidth = 341;
    const frameHeight = 341;

    // ── 이동 애니메이션 (3×3 그리드) ─────────────────
    spriteAnimation.addAnimation({
        name: 'monster_walk_down', frames: createFramesFromGrid(0, 0, frameWidth, frameHeight, 3, 3), frameRate: 6
    });
    spriteAnimation.addAnimation({
        name: 'monster_walk_left', frames: createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 3, 3), frameRate: 6
    });
    spriteAnimation.addAnimation({
        name: 'monster_walk_up', frames: createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 3, 3), frameRate: 6
    });
    spriteAnimation.addAnimation({
        name: 'monster_walk_right', frames: createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 3, 3), frameRate: 6
    });

    // ── Idle 애니메이션 ──────────────────────────────
    const idleDown = createFramesFromGrid(0, 0, frameWidth, frameHeight, 1, 3)[0];
    const idleLeft = createFramesFromGrid(0, frameHeight, frameWidth, frameHeight, 1, 3)[0];
    const idleRight = createFramesFromGrid(0, frameHeight * 2, frameWidth, frameHeight, 1, 3)[0];

    spriteAnimation.addAnimation({ name: 'monster_idle_down', frames: [idleDown], frameRate: 1 });
    spriteAnimation.addAnimation({ name: 'monster_idle_left', frames: [idleLeft], frameRate: 1 });
    spriteAnimation.addAnimation({ name: 'monster_idle_right', frames: [idleRight], frameRate: 1 });
    spriteAnimation.addAnimation({ name: 'monster_idle_up', frames: [idleLeft], frameRate: 1 });

    // ── 반격 애니메이션 — fight.png 5×5 그리드 ───────
    const fw = 205;   // fight.png 프레임 폭 (1025 / 5)
    const fh = 205;   // fight.png 프레임 높이 (1025 / 5)
    // 4행 사용 (DOWN 방향 위주로 반격 표현)
    spriteAnimation.addAnimation({
        name: 'monster_counter_attack',
        frames: createFramesFromGrid(0, fh * 3, fw, fh, 5, 5),
        frameRate: 12
    });
}
