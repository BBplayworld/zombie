import { Player } from "../entities/player/Player";
import { SkillManager, SkillKey } from "../entities/player/Skills";
import { stitchImageFrames, loadDirImages } from "../entities/player/PlayerAnimations";
import { Monster } from '../entities/Monster';
import { ItemDrop } from '../entities/ItemDrop';
import { Item } from '../entities/Item';
import { ZoneMap } from '../systems/ZoneMap';
import { InputManager } from '../systems/InputManager';
import { ResourceLoader } from '../systems/ResourceLoader';
import { CombatTextManager } from '../systems/CombatTextManager';
import { InventoryManager } from './InventoryManager';
import { InterfaceManager } from './InterfaceManager';

// ============================================================================
// PlayerManager.ts
//
// 〔담당 범위〕
//   - 게임 시작 시 플레이어 이미지/애니메이션 초기화 조율 (initialize)
//   - 매 프레임 입력 처리 (이동 / 스킬 쿨다운 업데이트)
//   - 공격 실행 조율 (handleAttack) — 데미지 계산, 넉백, CombatText 출력
//   - 아이템 자동 줍기 / 인벤토리 커서 처리
//
// 〔담당하지 않는 것〕
//   - 스프라이트 애니메이션 등록 → PlayerAnimations.ts
//   - 스킬 수치(쿨다운·범위·배율) → Skills.ts
//   - 이동·충돌·렌더              → Player.ts
// ============================================================================

/** 스킬별 이펙트 이미지 파일 경로 목록 (q~r: 개별 PNG → 스티칭 방식) */
const SKILL_FRAME_URLS: Partial<Record<SkillKey, string[]>> = {
    q: [
        '/assets/main/player/skills/q/q-1.png',
        '/assets/main/player/skills/q/q-2.png',
        '/assets/main/player/skills/q/q-3.png',
        '/assets/main/player/skills/q/q-4.png',
        '/assets/main/player/skills/q/q-5.png',
    ],
    // w, e, r 도 여기에 추가하면 됩니다:
    // w: ['/assets/main/player/skills/w/w-1.png', ...],
};

/** [Layer 1] 이동 쾐랙터 스프라이트 경로 (action/move-*.png) */
const MOVE_IMAGE_URLS = {
    left: '/assets/main/player/action/move-left.png',
    right: '/assets/main/player/action/move-right.png',
};

/** [Layer 1] space 평타 쾐랙터 동작 스프라이트 경로 (action/space-*.png) */
const SPACE_CHAR_IMAGE_URLS = {
    left: '/assets/main/player/action/space-left.png',
    right: '/assets/main/player/action/space-right.png',
};

/** [Layer 1] qwer 스킬 캐릭터 동작 스프라이트 경로 (action/skills-*.png) */
const SKILLS_CHAR_IMAGE_URLS = {
    left: '/assets/main/player/action/skills-left.png',
    right: '/assets/main/player/action/skills-right.png',
};

/** [Layer 3] 피격 캐릭터 스프라이트 경로 (action/damage-*.png) */
const DAMAGE_IMAGE_URLS = {
    left: '/assets/main/player/action/damage-left.png',
    right: '/assets/main/player/action/damage-right.png',
};

/** [Layer 2] space 평타 이펙트 프레임 경로 (skills/space/*.png) */
const SPACE_EFFECT_URLS = [
    '/assets/main/player/skills/space/q-1.png',
    '/assets/main/player/skills/space/q-2.png',
    '/assets/main/player/skills/space/q-3.png',
    '/assets/main/player/skills/space/q-4.png',
    '/assets/main/player/skills/space/q-5.png',
];

/** 스킬별 애니메이션 재생 속도 (FPS) */
const SKILL_FRAME_RATES: Partial<Record<SkillKey, number>> = {
    q: 14,
    // w: 12, e: 10, r: 8,
};

/** 아이템 자동 줍기 범위 (px) */
const ITEM_PICK_RANGE = 50;

export class PlayerManager {
    readonly player: Player;

    private resourceLoader: ResourceLoader;
    private inventoryManager: InventoryManager;
    private interfaceManager: InterfaceManager;
    private canvas: HTMLCanvasElement;
    private combatTextManager: CombatTextManager;

    public skillManager: SkillManager;

    private skillImagesLoaded = false;

    constructor(
        player: Player,
        _ZoneMap: ZoneMap,          // zone 맵은 Player.setZoneMap()으로 전달하므로 보관 불필요
        resourceLoader: ResourceLoader,
        inventoryManager: InventoryManager,
        interfaceManager: InterfaceManager,
        canvas: HTMLCanvasElement,
        combatTextManager: CombatTextManager,
    ) {
        this.player = player;
        this.resourceLoader = resourceLoader;
        this.inventoryManager = inventoryManager;
        this.interfaceManager = interfaceManager;
        this.canvas = canvas;
        this.combatTextManager = combatTextManager;
        this.skillManager = new SkillManager(this.player);
    }

    // =========================================================================
    // 초기화 (loadResources 이후 호출)
    // =========================================================================

    async initialize(ZoneMap: ZoneMap): Promise<void> {
        // 1. zone 맵 충돌 연결
        this.player.setZoneMap(ZoneMap);

        // 2. [Layer 1] 이동 케랙터 스프라이트 (action/move-*.png) 로드
        const moveImages = await loadDirImages(MOVE_IMAGE_URLS.left, MOVE_IMAGE_URLS.right);
        if (moveImages) this.player.setMoveImages(moveImages.left, moveImages.right);
        else console.warn('[PlayerManager] 이동 이미지 로드 실패');

        // 3. [Layer 1] space 평타 케랙터 동작 스프라이트 (action/space-*.png) 로드
        const spaceCharImages = await loadDirImages(SPACE_CHAR_IMAGE_URLS.left, SPACE_CHAR_IMAGE_URLS.right);
        if (spaceCharImages) this.player.setSpaceImages(spaceCharImages.left, spaceCharImages.right);
        else console.warn('[PlayerManager] space 케랙터 스프라이트 로드 실패');

        // 4. [Layer 1] qwer 스킬 캐릭터 동작 스프라이트 (action/skills-*.png) 로드
        const skillsCharImages = await loadDirImages(SKILLS_CHAR_IMAGE_URLS.left, SKILLS_CHAR_IMAGE_URLS.right);
        if (skillsCharImages) this.player.setSkillCharImages(skillsCharImages.left, skillsCharImages.right);
        else console.warn('[PlayerManager] skills 캐릭터 스프라이트 로드 실패');

        // 5. [Layer 3] 피격 캐릭터 스프라이트 (action/damage-*.png) 로드
        const damageImages = await loadDirImages(DAMAGE_IMAGE_URLS.left, DAMAGE_IMAGE_URLS.right);
        if (damageImages) this.player.setDamageImages(damageImages.left, damageImages.right);
        else console.warn('[PlayerManager] damage 이미지 로드 실패 (action/damage-left.png, damage-right.png 파일 확인)');

        // 6. [Layer 2] 스킬 이펙트 로드 (q/w/e/r + space)
        if (!this.skillImagesLoaded) {
            await this.loadSkillImages();
        }

        console.log('✅ [PlayerManager] Player initialized');
    }

    /**
     * SKILL_FRAME_URLS에 정의된 스킬 이미지를 로드·스티칭하고
     * Player에 등록 (skill_{key}_{방향} 애니메이션 자동 생성)
     */
    private async loadSkillImages(): Promise<void> {
        // [Layer 2] space 평타 이펙트 로드
        try {
            const spaceEffect = await stitchImageFrames(SPACE_EFFECT_URLS);
            if (spaceEffect) {
                this.player.setSkillImage('space', spaceEffect.canvas, spaceEffect.frameCount, 10);
            }
        } catch (e) {
            console.warn('[PlayerManager] Failed to load space effect images', e);
        }

        // [Layer 2] q/w/e/r 스킬 이펙트 로드
        const skillKeys = Object.keys(SKILL_FRAME_URLS) as SkillKey[];

        await Promise.all(
            skillKeys.map(async (key) => {
                const urls = SKILL_FRAME_URLS[key];
                if (!urls || urls.length === 0) return;

                try {
                    const result = await stitchImageFrames(urls);
                    if (result) {
                        const rate = SKILL_FRAME_RATES[key] ?? 14;
                        this.player.setSkillImage(key, result.canvas, result.frameCount, rate);
                    }
                } catch (e) {
                    console.warn(`[PlayerManager] Failed to load skill '${key}' images`, e);
                }
            })
        );

        this.skillImagesLoaded = true;
    }

    // =========================================================================
    // 매 프레임 업데이트
    // =========================================================================

    update(
        deltaTime: number,
        inputManager: InputManager,
        items: ItemDrop[],
        monsters: Monster[],
    ): ItemDrop[] {
        // 이동 입력
        const input = inputManager.getMovementInput();
        this.player.move(input.x, input.y);

        // 물리 / 애니메이션 / HP 회복
        this.player.update(deltaTime);

        // 스킬 쿨다운 카운트다운
        this.skillManager.update(deltaTime);

        // 몬스터 반격 피해 수신
        this.applyCounterAttackDamage(monsters);

        // 아이템 자동 줍기
        const remaining = this.pickUpItems(items);

        // 커서 / 인벤토리 hover
        this.handleCursor(inputManager);

        return remaining;
    }

    // =========================================================================
    // 공격 실행
    // =========================================================================

    /**
     * 스킬 / 평타 공격을 실행합니다.
     *
     * @param monsters  - 공격 대상 후보 목록
     * @param skillKey  - 사용할 스킬 키 (기본값 "space" = 평타)
     * @returns 실제로 히트한 몬스터 수
     */
    handleAttack(monsters: Monster[], skillKey: SkillKey = "space"): number {
        if (this.player.isAttacking) return 0;

        const skill = this.skillManager.executeSkill(skillKey);
        if (!skill) return 0; // 쿨다운 중

        const damageMult = skill.damageMultiplier;
        const dashSpeed = skill.dashSpeed ?? 0;

        // 평타(space)는 skillKey 없이 attack() 호출 → attack_방향 애니메이션 재생
        // 스킬(q/w/e/r)은 skillKey 전달 → skill_{key}_{방향} 애니메이션 재생
        this.player.attack(skillKey === "space" ? undefined : skillKey, dashSpeed);

        let hits = 0;
        monsters.forEach((monster) => {
            if (monster.isDead) return;

            if (!this.skillManager.checkHit(skill, monster.position.x, monster.position.y)) return;

            const { amount: baseAmount, isCrit } = this.player.getDamage();
            const amount = Math.floor(baseAmount * damageMult);

            monster.takeDamage(amount);

            // 스킬은 더 강하게 밀어냄
            const pushPower = 50 + (isCrit ? 30 : 0) + (skillKey !== "space" ? 100 : 0);
            monster.pushFrom(this.player.position.x, this.player.position.y, pushPower);

            this.combatTextManager.add(
                monster.position.x,
                monster.position.y - monster.height / 2,
                `- ${amount}`,
                isCrit ? "critical" : "normal",
            );

            hits++;
        });

        return hits;
    }

    // =========================================================================
    // 인벤토리 토글
    // =========================================================================

    toggleInventory(): void {
        this.player.toggleInventory();
        this.player.hoveredItem = null;
        this.canvas.style.cursor = 'default';
        if (this.player.isInventoryOpen) {
            this.player.inventoryMenu = null;
        }
    }

    // =========================================================================
    // private helpers
    // =========================================================================

    private applyCounterAttackDamage(monsters: Monster[]): void {
        monsters.forEach((monster) => {
            const dmg = monster.tryCounterAttack(this.player.position.x, this.player.position.y);
            if (dmg > 0) {
                this.player.takeDamage(dmg);
                this.combatTextManager.add(
                    this.player.position.x,
                    this.player.position.y - this.player.height / 2,
                    `- ${Math.floor(dmg)}`,
                    'player_hit',
                );
            }
        });
    }

    private pickUpItems(items: ItemDrop[]): ItemDrop[] {
        return items.filter((item) => {
            const dx = this.player.position.x - item.position.x;
            const dy = this.player.position.y - item.position.y;
            if (Math.sqrt(dx * dx + dy * dy) < ITEM_PICK_RANGE) {
                this.player.addItem(item.data);
                item.isCollected = true;
                return false;
            }
            return true;
        });
    }

    private handleCursor(inputManager: InputManager): void {
        if (this.player.isInventoryOpen) {
            this.inventoryManager.handleHover(inputManager);
        } else {
            const { x, y } = inputManager.getMousePosition();
            const rect = this.canvas.getBoundingClientRect();
            this.interfaceManager.handleHover(x - rect.left, y - rect.top);
            this.player.hoveredItem = null;
        }
    }
}
