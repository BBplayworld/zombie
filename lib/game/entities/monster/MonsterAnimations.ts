import { SpriteAnimation } from '../../systems/SpriteAnimation';
import type { MonsterDetailConfig } from '../../config/types';

function buildGridFrames(
    image: HTMLImageElement,
    cols: number,
    rows: number,
): { x: number; y: number; width: number; height: number }[] {
    const fw = image.naturalWidth / cols;
    const fh = image.naturalHeight / rows;
    const frames: { x: number; y: number; width: number; height: number }[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            frames.push({ x: c * fw, y: r * fh, width: fw, height: fh });
        }
    }
    return frames;
}

export function registerMonsterAnimations(
    spriteAnimation: SpriteAnimation,
    moveImage: HTMLImageElement | null,
    attackImage: HTMLImageElement | null,
    config: MonsterDetailConfig
): void {
    if (moveImage) {
        const { cols, rows } = config.moveImageGrid;
        const mapping: Record<string, HTMLImageElement> = {
            left: moveImage,
            up: moveImage,
            right: moveImage,
            down: moveImage,
        };

        for (const [dir, img] of Object.entries(mapping)) {
            const frames = buildGridFrames(img, cols, rows);
            // 걷기: 모든 프레임 순환
            spriteAnimation.addAnimation({ name: `monster_walk_${dir}`, frames, frameRate: 6 });
            // 대기: 첫 번째 프레임 고정
            spriteAnimation.addAnimation({ name: `monster_idle_${dir}`, frames: [frames[0]], frameRate: 2 });
        }
    }

    if (attackImage) {
        const { cols, rows } = config.attackImageGrid;
        const mapping: Record<string, HTMLImageElement> = {
            left: attackImage,
            up: attackImage,
            right: attackImage,
            down: attackImage,
        };

        for (const [dir, img] of Object.entries(mapping)) {
            const frames = buildGridFrames(img, cols, rows);
            // 공격: 모든 프레임 순환
            spriteAnimation.addAnimation({ name: `monster_attack_${dir}`, frames, frameRate: 8 });
        }
    }
}
