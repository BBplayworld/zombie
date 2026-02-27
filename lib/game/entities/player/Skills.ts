import { Player } from "./Player";

export type SkillKey = "space" | "q" | "w" | "e" | "r";

export interface SkillDefinition {
    id: SkillKey;
    cooldown: number; // in seconds
    damageMultiplier: number; // multiplier applied to base damage
    dashSpeed?: number; // if the skill includes a dash
    range?: number; // max range for hit detection
    duration?: number; // visual or execution duration
    type: "melee" | "projectile" | "directional"; // for hit detection logic
}

export class SkillManager {
    public player: Player;
    private cooldowns: Record<SkillKey, number> = {
        space: 0,
        q: 0,
        w: 0,
        e: 0,
        r: 0,
    };

    /**
     * Define the actual skill parameters here
     */
    public readonly skills: Record<SkillKey, SkillDefinition> = {
        space: {
            id: "space",
            cooldown: 0, // 기본 공격은 쿨타임 없음 (또는 공격 속도에 의존)
            damageMultiplier: 1.0,
            dashSpeed: 1200, // 기존 Player의 기본 대시 속도 1400 적용
            range: 250,      // PlayerManager.DEFAULT_ATTACK_RANGE
            duration: 0.3,
            type: "melee",
        },
        q: {
            id: "q",
            cooldown: 0,
            damageMultiplier: 2.5,
            dashSpeed: 500,
            range: 300,
            duration: 0.3,
            type: "directional",
        },
        w: { id: "w", cooldown: 5.0, damageMultiplier: 1.5, duration: 0.3, type: "melee" },
        e: { id: "e", cooldown: 5.0, damageMultiplier: 1.5, duration: 0.3, type: "melee" },
        r: { id: "r", cooldown: 10.0, damageMultiplier: 4.0, duration: 0.5, type: "melee" },
    };

    constructor(player: Player) {
        this.player = player;
    }

    public update(deltaTime: number): void {
        const keys: SkillKey[] = ["space", "q", "w", "e", "r"];
        keys.forEach((k) => {
            if (this.cooldowns[k] > 0) {
                this.cooldowns[k] -= deltaTime;
            }
        });
    }

    public canUseSkill(key: SkillKey): boolean {
        return this.cooldowns[key] <= 0;
    }

    public executeSkill(key: SkillKey): SkillDefinition | null {
        if (!this.canUseSkill(key)) return null;

        const skill = this.skills[key];
        this.cooldowns[key] = skill.cooldown;
        return skill;
    }

    public getCooldown(key: SkillKey): number {
        return Math.max(0, this.cooldowns[key]);
    }

    /**
     * 특정 몬스터가 이 스킬의 피격 범위 안에 있는지 판정합니다.
     */
    public checkHit(skill: SkillDefinition, monsterX: number, monsterY: number): boolean {
        const dx = monsterX - this.player.position.x;
        const dy = monsterY - this.player.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const range = skill.range || 250;

        if (skill.type === "directional") {
            // Forward dash attack logic - check if monster is in front within a rectangular bound
            const lookDir = this.player.getFacingVector();
            const dotProduct = dx * lookDir.x + dy * lookDir.y;
            const crossProduct = Math.abs(dx * lookDir.y - dy * lookDir.x);

            // Must be in front (dot > 0), within range, and within width of the straight line
            if (dotProduct > 0 && dotProduct <= range && crossProduct < 80) {
                return true;
            }
            return false;
        }

        // Circular logic for plain attack (melee) or others
        return dist <= range;
    }
}
