import { SpriteAnimation } from "../../systems/SpriteAnimation";

// ============================================================================
// PlayerAnimations.ts
//
// 이동·전투 이미지를 Player.spriteAnimation에 등록하는 순수 함수 모음.
//
// 〔역할 분리〕
//   - Player.ts          : 위치·속도·HP·인벤토리 등 상태 관리 + 렌더
//   - PlayerAnimations.ts: 이미지/애니메이션 등록 (이미지 교체 시 이 파일만 수정)
//   - Skills.ts          : 스킬 쿨다운, 범위, 데미지 배율 등 전투 수치 정의
//   - PlayerManager.ts   : 매 프레임 입력 처리, 데미지 계산, 이미지 로딩 조율
//
// 〔레이어 구조〕
//   Layer 1 (캐릭터 스프라이트) — action/ 디렉토리 이미지
//     - 이동   : action/move-left.png  / action/move-right.png
//     - space  : action/space-left.png / action/space-right.png
//     - skills : action/skills-left.png / action/skills-right.png
//
//   Layer 2 (이펙트 오버레이) — skills/ 디렉토리 이미지
//     - space  : skills/space/q-1~5.png
//     - q      : skills/q/q-1~5.png
//
// 〔이미지 파일 경로 규칙〕
//   /assets/main/player/action/move-left.png    — 이동 좌측 캐릭터 스프라이트
//   /assets/main/player/action/move-right.png   — 이동 우측 캐릭터 스프라이트
//   /assets/main/player/action/space-left.png   — space 공격 좌측 캐릭터 스프라이트
//   /assets/main/player/action/space-right.png  — space 공격 우측 캐릭터 스프라이트
//   /assets/main/player/action/skills-left.png  — qwer 스킬 좌측 캐릭터 스프라이트
//   /assets/main/player/action/skills-right.png — qwer 스킬 우측 캐릭터 스프라이트
//   /assets/main/player/skills/space/q-1~5.png  — space 이펙트 프레임
//   /assets/main/player/skills/q/q-1~5.png      — q 스킬 이펙트 프레임
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────────────

export interface DirImages {
    left: HTMLImageElement;
    right: HTMLImageElement;
}

// ─────────────────────────────────────────────────────────────────────────────
// 스프라이트시트 그리드 설정
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 이동(move) 스프라이트시트 그리드 설정.
 * action/move-left.png, action/move-right.png 이미지의 열·행 수.
 */
const MOVE_GRID = { cols: 1, rows: 2 };  // 2프레임

/**
 * space 캐릭터 공격 동작 스프라이트시트 그리드 설정.
 * action/space-left.png, action/space-right.png 이미지의 열·행 수.
 */
const SPACE_CHAR_GRID = { cols: 1, rows: 2 }; // 2프레임

/**
 * skills(qwer) 캐릭터 동작 스프라이트시트 그리드 설정.
 * action/skills-left.png, action/skills-right.png 이미지의 열·행 수.
 */
const SKILLS_CHAR_GRID = { cols: 1, rows: 2 }; // 2프레임

/**
 * damage 피격 캐릭터 스프라이트시트 그리드 설정.
 * action/damage-left.png, action/damage-right.png 이미지의 열행 수.
 */
const DAMAGE_CHAR_GRID = { cols: 1, rows: 2 }; // 2프레임 (이미지 구성에 따라 수정)

/** 이미지를 cols×rows 그리드로 분할해 프레임 배열을 반환 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1: 캐릭터 스프라이트 애니메이션 등록 (action/ 디렉토리)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 이동 캐릭터 스프라이트 등록 (action/move-left.png, action/move-right.png)
 * → walk_{방향} / idle_{방향} 애니메이션 등록
 *
 * left.png  → left·up 방향
 * right.png → right·down 방향
 */
export function registerMoveAnimations(
    spriteAnimation: SpriteAnimation,
    images: DirImages,
): void {
    const mapping: Record<string, HTMLImageElement> = {
        left: images.left,
        up: images.left,    // 후면은 left 이미지 사용
        right: images.right,
        down: images.right, // 정면은 right 이미지 사용
    };

    for (const [dir, img] of Object.entries(mapping)) {
        const frames = buildGridFrames(img, MOVE_GRID.cols, MOVE_GRID.rows);
        // 걷기: 모든 프레임 순환
        spriteAnimation.addAnimation({ name: `player_walk_${dir}`, frames, frameRate: 8 });
        // 대기: 첫 번째 프레임 고정
        spriteAnimation.addAnimation({ name: `player_idle_${dir}`, frames: [frames[0]], frameRate: 1 });
    }
}

/**
 * space 평타 캐릭터 동작 스프라이트 등록 (action/space-left.png, action/space-right.png)
 * → char_attack_{방향} 애니메이션 등록 (Layer 1 공격 모션)
 */
export function registerSpaceAnimations(
    spriteAnimation: SpriteAnimation,
    images: DirImages,
): void {
    const mapping: Record<string, HTMLImageElement> = {
        left: images.left,
        up: images.left,
        right: images.right,
        down: images.right,
    };

    for (const [dir, img] of Object.entries(mapping)) {
        const frames = buildGridFrames(img, SPACE_CHAR_GRID.cols, SPACE_CHAR_GRID.rows);
        spriteAnimation.addAnimation({
            name: `player_skills_action_space_${dir}`,
            frames,
            frameRate: 8,
            loop: false,
        });
    }
}

/**
 * qwer 스킬 캐릭터 동작 스프라이트 등록 (action/skills-left.png, action/skills-right.png)
 * → char_skill_{방향} 애니메이션 등록 (Layer 1 스킬 모션)
 */
export function registerSkillCharAnimations(
    spriteAnimation: SpriteAnimation,
    images: DirImages,
): void {
    const mapping: Record<string, HTMLImageElement> = {
        left: images.left,
        up: images.left,
        right: images.right,
        down: images.right,
    };

    for (const [dir, img] of Object.entries(mapping)) {
        const frames = buildGridFrames(img, SKILLS_CHAR_GRID.cols, SKILLS_CHAR_GRID.rows);
        spriteAnimation.addAnimation({
            name: `player_skills_action_qwer_${dir}`,
            frames,
            frameRate: 8,
            loop: false,
        });
    }
}

/**
 * 피격 캐릭터 애니메이션 등록 (action/damage-left.png, action/damage-right.png)
 * → char_damage_{방향} 애니메이션 등록
 *
 * left.png  → left·up 방향
 * right.png → right·down 방향
 */
export function registerDamageAnimations(
    spriteAnimation: SpriteAnimation,
    images: DirImages,
): void {
    const mapping: Record<string, HTMLImageElement> = {
        left: images.left,
        up: images.left,
        right: images.right,
        down: images.right,
    };

    for (const [dir, img] of Object.entries(mapping)) {
        const frames = buildGridFrames(img, DAMAGE_CHAR_GRID.cols, DAMAGE_CHAR_GRID.rows);
        spriteAnimation.addAnimation({
            name: `player_damage_${dir}`,
            frames,
            frameRate: 8,
            loop: false,
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2: 이펙트 오버레이 애니메이션 등록 (skills/ 디렉토리)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * space / qwer 스킬 이펙트 오버레이 애니메이션 등록
 * 개별 PNG 여러 장을 스티칭해 effect_{key}_{방향} 애니메이션으로 등록
 *
 * @param effectAnimation - Layer 2 전용 SpriteAnimation 인스턴스
 * @param key             - 스킬 키 ('space' | 'q' | 'w' | 'e' | 'r')
 * @param image           - 스티칭된 가로 스프라이트시트
 * @param frameCount      - 프레임 수
 * @param frameRate       - 재생 FPS
 */
export function registerSkillAnimations(
    effectAnimation: SpriteAnimation,
    key: string,
    image: HTMLImageElement | HTMLCanvasElement,
    frameCount: number = 1,
    frameRate: number = 14,
): void {
    const totalW = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    const totalH = image instanceof HTMLImageElement ? image.naturalHeight : image.height;

    const frameW = totalW / frameCount;
    const frameH = totalH;

    const frames: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < frameCount; i++) {
        frames.push({ x: i * frameW, y: 0, width: frameW, height: frameH });
    }

    // 모든 방향에 동일한 프레임 사용
    for (const dir of ["up", "down", "left", "right"] as const) {
        effectAnimation.addAnimation({
            name: `player_skills_effect_${key}_${dir}`,
            frames,
            frameRate,
            loop: false,
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 유틸: 개별 PNG 여러 장 → 가로 스프라이트시트(Canvas)로 병합
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 개별 PNG 파일 여러 장을 하나의 가로 스프라이트시트로 합쳐 HTMLCanvasElement로 반환
 */
export async function stitchImageFrames(
    urls: string[]
): Promise<{ canvas: HTMLCanvasElement; frameCount: number } | null> {
    const loaded = await Promise.all(
        urls.map(
            (url) =>
                new Promise<HTMLImageElement>((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(img);
                    img.src = url;
                })
        )
    );

    const valid = loaded.filter((img) => img.width > 0);
    if (valid.length === 0) return null;

    const maxW = Math.max(...valid.map((img) => img.width));
    const maxH = Math.max(...valid.map((img) => img.height));

    const canvas = document.createElement("canvas");
    canvas.width = maxW * valid.length;
    canvas.height = maxH;
    const ctx = canvas.getContext("2d")!;

    valid.forEach((img, i) => {
        const dx = i * maxW + (maxW - img.width) / 2;
        const dy = (maxH - img.height) / 2;
        ctx.drawImage(img, dx, dy);
    });

    return { canvas, frameCount: valid.length };
}

/**
 * left / right 두 URL을 로드해 DirImages 객체로 반환
 */
export async function loadDirImages(
    leftUrl: string,
    rightUrl: string,
): Promise<DirImages | null> {
    const [left, right] = await Promise.all(
        [leftUrl, rightUrl].map(
            (url) =>
                new Promise<HTMLImageElement>((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(img);
                    img.src = url;
                })
        )
    );
    if (left.width === 0 || right.width === 0) return null;
    return { left, right };
}
