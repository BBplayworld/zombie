// ============================================================================
// LevelSystem.ts
//
// 플레이어 레벨 시스템 (최대 레벨 30)
// - 레벨별 필요 경험치 테이블
// - 경험치 획득 (몬스터 처치)
// - 레벨업 처리 (스탯 증가)
// ============================================================================

export const MAX_LEVEL = 30;

/**
 * 레벨별 누적 경험치 테이블 (level 1 = 0, level 2 = 100, ...)
 * EXP_TABLE[i] = 레벨 i에서 레벨 i+1이 되기 위한 필요 경험치
 */
export function getRequiredExp(level: number): number {
    if (level >= MAX_LEVEL) return Infinity;
    // 완만한 곡선: 100 * level^1.5 (소수점 없이)
    return Math.floor(100 * Math.pow(level, 1.5));
}

export interface LevelUpResult {
    newLevel: number;
    statGains: { Vigor: number; Spirit: number; Might: number; Agility: number; Luck: number };
}

export class LevelSystem {
    public level: number = 1;
    public currentExp: number = 0;

    // 레벨업 시 올라가는 기본 스탯량
    private static readonly STAT_GAIN_PER_LEVEL = {
        Vigor: 2,
        Spirit: 1,
        Might: 1,
        Agility: 1,
        Luck: 1,
    };

    constructor(level: number = 1, exp: number = 0) {
        this.level = Math.min(level, MAX_LEVEL);
        this.currentExp = exp;
    }

    /** 필요 경험치 반환 */
    get requiredExp(): number {
        return getRequiredExp(this.level);
    }

    /** 경험치 진행도 (0~1) */
    get expProgress(): number {
        if (this.level >= MAX_LEVEL) return 1;
        return Math.min(1, this.currentExp / this.requiredExp);
    }

    /**
     * 경험치 획득
     * @returns 레벨업 결과 배열 (여러 번 레벨업 가능)
     */
    gainExp(amount: number): LevelUpResult[] {
        if (this.level >= MAX_LEVEL) return [];

        this.currentExp += amount;
        const results: LevelUpResult[] = [];

        while (this.level < MAX_LEVEL && this.currentExp >= this.requiredExp) {
            this.currentExp -= this.requiredExp;
            this.level++;

            results.push({
                newLevel: this.level,
                statGains: { ...LevelSystem.STAT_GAIN_PER_LEVEL },
            });
        }

        if (this.level >= MAX_LEVEL) {
            this.currentExp = 0;
        }

        return results;
    }

    /** 직렬화 (저장용) */
    serialize(): { level: number; exp: number } {
        return { level: this.level, exp: this.currentExp };
    }

    /** 역직렬화 (로딩용) */
    static deserialize(data: { level: number; exp: number }): LevelSystem {
        return new LevelSystem(data.level, data.exp);
    }
}

/**
 * 몬스터 처치 경험치 계산
 * - 기본: 20 + level * 5
 * - 플레이어 레벨보다 낮은 몬스터는 감소 페널티
 */
export function calcMonsterExp(monsterLevel: number, playerLevel: number): number {
    const base = 20 + monsterLevel * 5;
    const diff = playerLevel - monsterLevel;
    if (diff <= 0) return base;
    if (diff >= 5) return Math.max(1, Math.floor(base * 0.1)); // 5레벨 이상 낮으면 10%
    return Math.max(1, Math.floor(base * (1 - diff * 0.18)));
}
